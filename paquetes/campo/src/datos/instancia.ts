import { abrirBase, repositorioDexie } from "./dexie";

export const repositorio = repositorioDexie(abrirBase());
