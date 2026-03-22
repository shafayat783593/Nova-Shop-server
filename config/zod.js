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



const forgotSchema = z.object({
    email: z.string().email("Invalid email address"),
});

const resetSchema = z.object({
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