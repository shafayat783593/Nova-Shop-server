import mongoose  from "mongoose";

const connectDb= async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI, {dbName: "E-comarce" })
        console.log("MONGO_URI:", process.env.MONGO_URI);
        console.log("mongodb Connecct")
    } catch (error) {
        console.error("❌ MongoDB Connection Error:");
        console.error(error);
    }
}
export default connectDb
