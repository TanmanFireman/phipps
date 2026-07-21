import { Archive } from "./runtime/libarchive.js";

function download(url, label, report) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "blob";
    request.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : null;
      report(label, event.loaded, total);
    };
    request.onerror = () => reject(new Error(`Could not download ${url}`));
    request.onload = () => {
      if (request.status !== 200) {
        reject(new Error(`${url} returned HTTP ${request.status}`));
        return;
      }
      resolve(request.response);
    };
    request.send();
  });
}

export async function loadGameData(report) {
  const customPakPromise = download("game/pak6.pak", "Loading Phipps combat pack", report);
  const archiveBlob = await download("assets/lq.bin", "Loading open game data", report);

  report("Opening LibreQuake archive", 0, null);
  const archiveFile = new File([archiveBlob], "librequake.7z", { type: "application/x-7z-compressed" });
  const archive = await Archive.open(archiveFile);

  try {
    const contents = await archive.getFilesObject();
    const paks = {};
    for (let index = 0; index < 6; index += 1) {
      const name = `pak${index}.pak`;
      const file = contents[name];
      if (!file) throw new Error(`LibreQuake archive is missing ${name}`);
      report(`Unpacking open data ${index + 1} of 6`, index, 6);
      const extracted = await file.extract();
      paks[name] = new Uint8Array(await extracted.arrayBuffer());
    }

    const customPak = await customPakPromise;
    paks["pak6.pak"] = new Uint8Array(await customPak.arrayBuffer());
    return paks;
  } finally {
    await archive.close();
  }
}
