import { z as zlibSync, u as unzlibSync } from "./browser-CwsEWr7C.js";
var Zlib = class Zlib2 {
  static codecId = "zlib";
  level;
  constructor(level = 1) {
    if (level < -1 || level > 9) {
      throw new Error("Invalid zlib compression level, it should be between -1 and 9");
    }
    this.level = level;
  }
  static fromConfig({ level }) {
    return new Zlib2(level);
  }
  encode(data) {
    return zlibSync(data, { level: this.level });
  }
  decode(data) {
    return unzlibSync(data);
  }
};
var zlib_default = Zlib;
export {
  zlib_default as default
};
//# sourceMappingURL=zlib-Dk1NUtlh.js.map
