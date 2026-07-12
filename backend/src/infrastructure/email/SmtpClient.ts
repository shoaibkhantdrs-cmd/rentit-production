import { connect as tlsConnect, TLSSocket } from "tls";
import { Socket, createConnection } from "net";

export interface SmtpConfig {
  host: string;
  port: number;
  /** true for implicit TLS (port 465); STARTTLS is negotiated automatically
   * on plaintext connections when the server advertises it. */
  secure: boolean;
  username: string;
  password: string;
}

export interface SmtpEnvelope {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * A minimal SMTP client (RFC 5321/2487) built on nothing but Node's
 * built-in `net`/`tls` modules -- the same "hand-roll the protocol, no
 * SDK" call made for chat's WebSocketGateway and FCM's OAuth2 exchange,
 * because this sandbox cannot install `nodemailer` (no npm registry
 * access -- see docs/phase-5.md).
 *
 * Supports exactly what sending a templated transactional email needs:
 * implicit TLS or STARTTLS, AUTH LOGIN, a single recipient per call. It
 * does not implement SMTP extensions like DSN receipts, 8BITMIME
 * negotiation edge cases, or connection pooling -- deliberately out of
 * scope for a "send this OTP/welcome/reset email" use case.
 */
export class SmtpClient {
  constructor(private readonly config: SmtpConfig) {}

  async send(envelope: SmtpEnvelope): Promise<void> {
    const socket = await this.connect();
    try {
      await readResponse(socket, [220]);
      await this.ehlo(socket);

      let activeSocket: Socket | TLSSocket = socket;
      if (!this.config.secure) {
        await command(socket, "STARTTLS", [220]);
        activeSocket = await upgradeToTls(socket, this.config.host);
        await this.ehlo(activeSocket);
      }

      await command(activeSocket, "AUTH LOGIN", [334]);
      await command(activeSocket, Buffer.from(this.config.username).toString("base64"), [334]);
      await command(activeSocket, Buffer.from(this.config.password).toString("base64"), [235]);

      await command(activeSocket, `MAIL FROM:<${envelope.from}>`, [250]);
      await command(activeSocket, `RCPT TO:<${envelope.to}>`, [250, 251]);
      await command(activeSocket, "DATA", [354]);

      const message = buildMimeMessage(envelope);
      await command(activeSocket, `${message}\r\n.`, [250]);
      await command(activeSocket, "QUIT", [221]);
    } finally {
      socket.destroy();
    }
  }

  private connect(): Promise<Socket | TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket = this.config.secure
        ? tlsConnect({ host: this.config.host, port: this.config.port })
        : createConnection({ host: this.config.host, port: this.config.port });

      socket.once("error", reject);
      socket.once("connect", () => resolve(socket));
      if (this.config.secure) {
        (socket as TLSSocket).once("secureConnect", () => resolve(socket));
      }
    });
  }

  private async ehlo(socket: Socket | TLSSocket): Promise<void> {
    await command(socket, `EHLO ${this.config.host}`, [250]);
  }
}

function command(socket: Socket | TLSSocket, line: string, expectedCodes: number[]): Promise<string> {
  socket.write(`${line}\r\n`);
  return readResponse(socket, expectedCodes);
}

function readResponse(socket: Socket | TLSSocket, expectedCodes: number[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      // A multi-line SMTP response has "code-text" on all but the last
      // line, which is "code text" (space, not hyphen, after the code).
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || /^\d{3}-/.test(last)) return; // still waiting for the terminal line

      cleanup();
      const code = parseInt(buffer.slice(0, 3), 10);
      if (!expectedCodes.includes(code)) {
        reject(new Error(`Unexpected SMTP response (wanted ${expectedCodes.join("/")}): ${buffer.trim()}`));
        return;
      }
      resolve(buffer);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function upgradeToTls(socket: Socket, host: string): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tlsConnect({ socket, host });
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
  });
}

function buildMimeMessage(envelope: SmtpEnvelope): string {
  const boundary = `----rentit-${Date.now()}`;
  const dotStuffedHtml = envelope.html.replace(/\n\./g, "\n..");
  const dotStuffedText = envelope.text.replace(/\n\./g, "\n..");

  return [
    `From: RentIt <${envelope.from}>`,
    `To: ${envelope.to}`,
    `Subject: ${envelope.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    dotStuffedText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    dotStuffedHtml,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}
