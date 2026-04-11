import {  email, z } from "zod";
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

export const resetSchema = z.object({
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
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