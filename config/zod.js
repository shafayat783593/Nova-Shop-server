import {  z } from "zod";
export const registerSchema =z.object({
    name:z.string().min(3, "Name must be at lest 3 characters long"),
    email:z.string().email("Invalide eamil format"),
    password:z.string().min(8, "password must be at least 8 chracters long")

})



export const loginSchema = z.object({
    email:z.string().email("Invalide email formate"),
    password:z.string().min(8,"password must be at least 8 chracters logn")
})



export const forgotSchema = z.object({
    email: z.string().email("Invalid email address"),
});

// ✅ নতুন schema — resetPassword route এ এটা ব্যবহার করো
export const resetPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().min(6, "OTP must be 6 digits").max(6, "OTP must be 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});




export const shopCreateSchema = z.object({
    shopName: z.string().min(3, "Shop name must be at least 3 characters").max(50),
    category: z.string().min(1, "Category is required"),
    description: z.string().min(20, "Min 20 characters").optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    businessEmail: z.string().email("Invalid business email"),
    businessPhone: z.string().regex(/^(?:\+88|88)?(01[3-9]\d{8})$/, "Invalid BD phone number"),
    pickupAddress: z.string().min(10, "Address is too short"),
    nidNumber: z.string().min(10).max(17),
    nidFront: z.string().min(1, "NID front image is required"),
    nidBack: z.string().min(1, "NID back image is required"),
    logo: z.string().optional(),
    payoutMethod: z.enum(["bank", "bkash", "nagad"]),
    bankName: z.string().optional(),
    accountHolder: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    mfsNumber: z.string().optional(),
}).refine((data) => {
    if (data.payoutMethod === 'bank') {
        return !!(data.bankName && data.accountHolder && data.accountNumber);
    }
    if (data.payoutMethod === 'bkash' || data.payoutMethod === 'nagad') {
        return !!data.mfsNumber;
    }
    return true;
}, {
    message: "Please provide complete payout details for the selected method",
    path: ["payoutMethod"],
});






export const variantSchema = z.object({
    size: z
        .string()
        .trim()
        .min(1, "Size is required")
        .optional(),           // ← Election product এর জন্য optional

    color: z
        .string()
        .trim()
        .min(1, "Color is required")
        .optional(),           // ← Election product এর জন্য optional

    stock: z
        .number({ invalid_type_error: "Stock must be a number" })
        .int("Stock must be an integer")
        .min(0, "Stock cannot be negative"),

    price: z
        .number({ invalid_type_error: "Price must be a number" })
        .positive("Price must be positive"),

    sku: z.string().trim().optional(),
});










// Main Product Schema
export const productSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(120, "Name is too long"),

    description: z
        .string()
        .min(10, "Description must be at least 10 characters")
        .max(2000, "Description is too long"),

    category: z.string().min(1, "Category is required"),

    tags: z.array(z.string().trim()).optional().default([]),

    basePrice: z
        .number({ invalid_type_error: "Base price must be a number" })
        .positive("Base price must be positive"),

    discountedPrice: z
        .number({ invalid_type_error: "Discounted price must be a number" })
        .nonnegative("Discounted price cannot be negative")
        .optional(),

    images: z
        .array(z.string().url("Each image must be a valid URL"))
        .min(1, "At least one image is required"),

    gallery: z
        .array(z.string().url("Gallery images must be valid URLs"))
        .optional()
        .default([]),

    // 🔥 এখানে পরিবর্তন করা হয়েছে
    hasVariants: z.boolean().default(false),

    variants: z
        .array(variantSchema)
        .optional()
        .default([]),

    isActive: z.boolean().optional().default(true),
    isFeatured: z.boolean().optional().default(false),
})
    // Custom Validation: যদি hasVariants true হয়, তাহলে অন্তত ১টা variant থাকতে হবে
    .superRefine((data, ctx) => {
        if (data.hasVariants === true) {
            if (!data.variants || data.variants.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["variants"],
                    message: "At least one variant is required when hasVariants is true",
                });
            }

            // Optional: size/color চেক করতে পারো (যদি চাও)
            data.variants.forEach((variant, index) => {
                if (!variant.size) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["variants", index, "size"],
                        message: "Size is required for variants",
                    });
                }
                if (!variant.color) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["variants", index, "color"],
                        message: "Color is required for variants",
                    });
                }
            });
        }
    });

export const productUpdateSchema = productSchema.partial();