import mongoose from "mongoose";
const schema = new mongoose.Schema(

    {
        name: {
            type: String,
            require: true
        },
        email: {
            type: String,
            require: true,
            unique: true

        },
        password: {
            type: String,
            require: true
        },
        role: {
            type: String,
            enum: ["customer", "owner", "deliveryboy","admin"], 
            default: "customer",
        },
        avatar: {
            type: String,
            default: null,
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },

    }, { timestamps: true }
)

export const User = mongoose.model("User", schema)