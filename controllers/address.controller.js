import Address from "../models/address.model.js";
import {
    allDivision, districtsOf, upazilaNamesOf, isValidDivision,
    isValidDistrict, getDivisionOfDistrict
}
    from "../utils/Bangladeshaddress.js";;

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── GET address dropdown data (for frontend selects) ─────────────────────────
// GET /api/addresses/location-data
// Returns divisions, and optionally districts/upazilas based on query params
export const getLocationData = (req, res) => {
    const { division, district } = req.query;

    // All divisions always returned
    const divisions = allDivision();

    // Districts for a selected division
    const districts = division && isValidDivision(division)
        ? districtsOf(division)
        : [];

    // Upazilas for a selected district
    const upazilas = district && isValidDistrict(district)
        ? upazilaNamesOf(district)
        : [];

    return res.status(200).json({
        success: true,
        data: { divisions, districts, upazilas },
    });
};

// ─── GET all addresses for logged-in user ─────────────────────────────────────
// GET /api/addresses
export const getMyAddresses = async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.user._id })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({ success: true, data: addresses });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADD new address ──────────────────────────────────────────────────────────
// POST /api/addresses
export const addAddress = async (req, res) => {
    try {
        const {
            fullName, phone, addressLine,
            division, district, area,
            postalCode, label, isDefault,
        } = req.body;

        // ── Required field check ──────────────────────────────────────────
        if (!fullName || !phone || !addressLine || !division || !district || !area) {
            return sendError(
                res,
                "fullName, phone, addressLine, division, district and area are required",
                400
            );
        }

        // ── Bangladesh validation ─────────────────────────────────────────
        if (!isValidDivision(division)) {
            return sendError(res, `"${division}" is not a valid Bangladesh division`, 400);
        }
        if (!isValidDistrict(district)) {
            return sendError(res, `"${district}" is not a valid Bangladesh district`, 400);
        }

        // District must belong to selected division
        const actualDivision = getDivisionOfDistrict(district);
        if (actualDivision && actualDivision !== division) {
            return sendError(
                res,
                `District "${district}" belongs to "${actualDivision}", not "${division}"`,
                400
            );
        }

        // Validate upazila belongs to district
        const validUpazilas = upazilaNamesOf(district);
        if (validUpazilas.length > 0 && !validUpazilas.includes(area)) {
            return sendError(
                res,
                `"${area}" is not a valid upazila of "${district}"`,
                400
            );
        }

        // First address is always default
        const count = await Address.countDocuments({ user: req.user._id });
        const shouldBeDefault = isDefault || count === 0;

        const address = new Address({
            user: req.user._id,
            fullName, phone, addressLine,
            division, district, area,
            postalCode: postalCode || "",
            label: label || "Home",
            isDefault: shouldBeDefault,
        });

        await address.save();

        return res.status(201).json({
            success: true,
            message: "Address added successfully",
            data: address,
        });
    } catch (err) {
        if (err.name === "ValidationError") {
            const msg = Object.values(err.errors)[0]?.message;
            return sendError(res, msg || "Validation failed", 400);
        }
        return sendError(res, err.message);
    }
};

// ─── UPDATE address ───────────────────────────────────────────────────────────
// PUT /api/addresses/:id
export const updateAddress = async (req, res) => {
    try {
        const address = await Address.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!address) return sendError(res, "Address not found", 404);

        const {
            fullName, phone, addressLine,
            division, district, area,
            postalCode, label, isDefault,
        } = req.body;

        // Re-validate Bangladesh hierarchy if location fields changed
        if (division || district) {
            const newDivision = division || address.division;
            const newDistrict = district || address.district;

            if (!isValidDivision(newDivision)) {
                return sendError(res, `"${newDivision}" is not a valid division`, 400);
            }
            if (!isValidDistrict(newDistrict)) {
                return sendError(res, `"${newDistrict}" is not a valid district`, 400);
            }

            const actualDiv = getDivisionOfDistrict(newDistrict);
            if (actualDiv && actualDiv !== newDivision) {
                return sendError(
                    res,
                    `District "${newDistrict}" belongs to "${actualDiv}", not "${newDivision}"`,
                    400
                );
            }

            if (area || address.area) {
                const newArea = area || address.area;
                const validUpazilas = upazilaNamesOf(newDistrict);
                if (validUpazilas.length > 0 && !validUpazilas.includes(newArea)) {
                    return sendError(res, `"${newArea}" is not a valid upazila of "${newDistrict}"`, 400);
                }
            }
        }

        // Apply updates
        if (fullName) address.fullName = fullName;
        if (phone) address.phone = phone;
        if (addressLine) address.addressLine = addressLine;
        if (division) address.division = division;
        if (district) address.district = district;
        if (area) address.area = area;
        if (postalCode !== undefined) address.postalCode = postalCode;
        if (label) address.label = label;
        if (isDefault !== undefined) address.isDefault = isDefault;

        await address.save();

        return res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: address,
        });
    } catch (err) {
        if (err.name === "ValidationError") {
            const msg = Object.values(err.errors)[0]?.message;
            return sendError(res, msg || "Validation failed", 400);
        }
        return sendError(res, err.message);
    }
};

// ─── DELETE address ───────────────────────────────────────────────────────────
// DELETE /api/addresses/:id
export const deleteAddress = async (req, res) => {
    try {
        const address = await Address.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!address) return sendError(res, "Address not found", 404);

        // If deleted was default → make the next one default
        if (address.isDefault) {
            const next = await Address.findOne({ user: req.user._id }).sort("-createdAt");
            if (next) {
                next.isDefault = true;
                await next.save();
            }
        }

        return res.status(200).json({ success: true, message: "Address deleted" });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── SET default address ──────────────────────────────────────────────────────
// PATCH /api/addresses/:id/default
export const setDefaultAddress = async (req, res) => {
    try {
        const address = await Address.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!address) return sendError(res, "Address not found", 404);

        address.isDefault = true;
        await address.save(); // pre-save hook handles clearing others

        return res.status(200).json({
            success: true,
            message: "Default address updated",
            data: address,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};