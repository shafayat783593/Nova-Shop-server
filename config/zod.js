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