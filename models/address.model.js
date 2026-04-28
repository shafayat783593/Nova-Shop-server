import mongoose from "mongoose";
import {
    isValidDivision,
    isValidDistrict,
    getDivisionOfDistrict,
} from "@bangladeshi/bangladesh-address";

const addressSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        label: {
            type: String,
            enum: ["Home", "Office", "Other"],
            default: "Home",
        },

        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        addressLine: { type: String, required: true, trim: true },

        // ── Bangladesh administrative hierarchy ───────────────────────────
        division: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: (v) => isValidDivision(v),
                message: (p) => `"${p.value}" is not a valid Bangladesh division`,
            },
        },

        district: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: (v) => isValidDistrict(v),
                message: (p) => `"${p.value}" is not a valid Bangladesh district`,
            },
        },

        // Thana / Upazila — string only, validated in controller via package
        area: {
            type: String,
            required: true,
            trim: true,
        },

        postalCode: { type: String, trim: true, default: "" },
        isDefault: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// ─── Cross-field: district must belong to selected division ──────────────────
addressSchema.pre("validate", function (next) {
    if (this.district && this.division) {
        const actualDivision = getDivisionOfDistrict(this.district);
        if (actualDivision && actualDivision !== this.division) {
            this.invalidate(
                "district",
                `"${this.district}" belongs to "${actualDivision}", not "${this.division}"`
            );
        }
    }
    next();
});

// ─── Only one default address per user ───────────────────────────────────────
addressSchema.pre("save", async function (next) {
    if (this.isDefault && this.isModified("isDefault")) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { isDefault: false }
        );
    }
    next();
});

export default mongoose.model("Address", addressSchema);