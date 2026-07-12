import { Request, Response } from "express";
import { z } from "zod";
import { CreateSavedSearchUseCase } from "@/application/savedsearches/CreateSavedSearch.usecase";
import { ListSavedSearchesUseCase } from "@/application/savedsearches/ListSavedSearches.usecase";
import { UpdateSavedSearchUseCase } from "@/application/savedsearches/UpdateSavedSearch.usecase";
import { DeleteSavedSearchUseCase } from "@/application/savedsearches/DeleteSavedSearch.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  createSavedSearchSchema,
  updateSavedSearchSchema,
} from "@/interfaces/http/validators/savedsearch.schemas";

export class SavedSearchController {
  constructor(
    private readonly createSavedSearch: CreateSavedSearchUseCase,
    private readonly listSavedSearches: ListSavedSearchesUseCase,
    private readonly updateSavedSearch: UpdateSavedSearchUseCase,
    private readonly deleteSavedSearch: DeleteSavedSearchUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof createSavedSearchSchema>;
    const result = await this.createSavedSearch.execute({ userId: req.user.sub, ...body });
    res.status(201).json(result);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.listSavedSearches.execute(req.user.sub);
    res.status(200).json({ items: result });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateSavedSearchSchema>;
    const result = await this.updateSavedSearch.execute({
      savedSearchId: req.params.id,
      requesterId: req.user.sub,
      ...body,
    });
    res.status(200).json(result);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.deleteSavedSearch.execute({ savedSearchId: req.params.id, requesterId: req.user.sub });
    res.status(204).send();
  };
}
