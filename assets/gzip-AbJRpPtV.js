import { g as gzipSync, a as gunzipSync } from "./browser-CwsEWr7C.js";
var GZip = class GZip2 {
  static codecId = "gzip";
  level;
  constructor(level = 1) {
    if (level < 0 || level > 9) {
      throw new Error("Invalid gzip compression level, it should be between 0 and 9");
    }
    this.level = level;
  }
  static fromConfig({ level }) {
    return new GZip2(level);
  }
  encode(data) {
    return gzipSync(data, { level: this.level });
  }
  decode(data) {
    return gunzipSync(data);
  }
};
var gzip_default = GZip;
export {
  gzip_default as default
};
//# sourceMappingURL=gzip-AbJRpPtV.js.map
