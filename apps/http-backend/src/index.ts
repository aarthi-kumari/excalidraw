import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, SigninSchema, CreateRoomSchema } from "@repo/common/types";	
import { prisma } from "@repo/db/client";


const app = express();

app.post("/signup",(req, res) =>{
	const data = CreateUserSchema.safeParse(req.body);
	if (!data.success) {
		 res.json({
			message: "Incorrect inputs"
		})
		return;
	}
	
	res.json({
		userId: "123"
	})

} )

app.post("/signin",(req, res) =>{
	const data = SigninSchema.safeParse(req.body);
	if (!data.success) {
		 res.json({
			message: "Incorrect inputs"
		})
		return;
	}
     const userId = 1;
	 const token = jwt.sign({
		userId
	 }, JWT_SECRET);
	 res.json({
		token
   })
})

app.post("/room", middleware,(req, res) => {
	const data = CreateRoomSchema.safeParse(req.body);
	if (!data.success) {
		 res.json({
			message: "Incorrect inputs"
		})
		return;
	}
	res.json({
		roomId: 123
	})
 
})
app.listen(3001);






const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
	console.log(`http-backend listening on http://localhost:${port}`);
});