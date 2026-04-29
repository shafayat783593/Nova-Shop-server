import express from "express";
import {
    getLocationData,
    getMyAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from "../controllers/address.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const addressRouter = express.Router();

// Public — frontend uses this to populate division/district/upazila dropdowns
addressRouter.get("/location-data", getLocationData);

// All below require login
addressRouter.use(isAuth);

addressRouter.get("/", getMyAddresses);
addressRouter.post("/", addAddress);
addressRouter.put("/:id", updateAddress);
addressRouter.delete("/:id", deleteAddress);
addressRouter.patch("/:id/default", setDefaultAddress);

export default addressRouter;
