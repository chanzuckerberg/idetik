import * as zarr from "zarrita";
import { Plate } from "data/zarr/0.4/plate";
import { Well } from "data/zarr/0.4/well";

export async function loadOmeZarrPlate(url: string): Promise<Plate> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  return group.attrs as Plate;
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<Well> {
  const store = new zarr.FetchStore(url + "/" + path);
  const root = await zarr.open.v2(store, { kind: "group" });

  return root.attrs as Well;
}
