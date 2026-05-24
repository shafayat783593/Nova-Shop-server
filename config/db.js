import mongoose  from "mongoose";
import dns from "dns";
dns.setServers(["1.1.1.1","8.8.8.8"]);
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
