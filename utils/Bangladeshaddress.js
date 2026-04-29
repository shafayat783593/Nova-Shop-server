// utils/bangladeshAddress.js
//
// The @bangladeshi/bangladesh-address package has a broken `main` field in
// package.json — it points to ./build/index.js but the file lives at
// ./build/src/index.js. This wrapper imports from the correct path using
// createRequire (safe for ESM projects).

import { createRequire } from "module";

const require = createRequire(import.meta.url);

const bd = require("@bangladeshi/bangladesh-address/build/src/index.js");

export const allDivision = bd.allDivision;
export const allDistricts = bd.allDistricts;
export const districtsOf = bd.districtsOf;
export const upazilaNamesOf = bd.upazilaNamesOf;
export const isValidDivision = bd.isValidDivision;
export const isValidDistrict = bd.isValidDistrict;
export const getDivisionOfDistrict = bd.getDivisionOfDistrict;
export const upazilasOf = bd.upazilasOf;
export const searchLocations = bd.searchLocations;