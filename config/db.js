import mongoose  from "mongoose";

const connectDb= async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI, {dbName: "E-comarce" })
        console.log("mongodb Connecct")
    } catch (error) {
        console.log("Failed to conect ")
    }
}
export default connectDb
