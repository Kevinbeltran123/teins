import { abrirBase, repositorioDexie } from "./dexie";

export const db = abrirBase();
export const repositorio = repositorioDexie(db);
