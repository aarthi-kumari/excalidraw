import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, SigninSchema, CreateRoomSchema } from "@repo/common/types";	
import { prisma } from "@repo/db/client";


const app = express();
app.use(cors());
app.use(express.json());

app.post("/signup", async (req, res) => {
	const data = CreateUserSchema.safeParse(req.body);
	if (!data.success) {
		res.status(400).json({
			message: "Incorrect inputs"
		});
		return;
	}

	const existingUser = await prisma.user.findUnique({
		where: {
			email: data.data.email
		}
	});

	if (existingUser) {
		res.status(409).json({
			message: "User already exists"
		});
		return;
	}

	const user = await prisma.user.create({
		data: {
			email: data.data.email,
			password: data.data.password,
			name: data.data.name,
			photo: data.data.photo ?? ""
		}
	});

	res.json({
		userId: user.id
	});

});

app.post("/signin", async (req, res) => {
	const data = SigninSchema.safeParse(req.body);
	if (!data.success) {
		res.status(400).json({
			message: "Incorrect inputs"
		});
		return;
	}

	const user = await prisma.user.findUnique({
		where: {
			email: data.data.email
		}
	});

	if (!user || user.password !== data.data.password) {
		res.status(401).json({
			message: "Invalid credentials"
		});
		return;
	}

	const token = jwt.sign({
		userId: user.id
	}, JWT_SECRET);

	res.json({
		token
   });
});

app.post("/room", middleware, async (req, res) => {
	const data = CreateRoomSchema.safeParse(req.body);
	if (!data.success) {
		res.status(400).json({
			message: "Incorrect inputs"
		});
		return;
	}

	if (!req.userId || typeof req.userId !== "string") {
		res.status(403).json({
			message: "Unauthorized"
		});
		return;
	}

	const normalizedSlug = data.data.roomName.trim().toLowerCase().replace(/\s+/g, "-");
	const slug = `${normalizedSlug}-${Math.floor(Math.random() * 10000)}`;

	const room = await prisma.room.create({
		data: {
			slug,
			adminId: req.userId
		}
	});

	res.json({
		roomId: room.id,
		slug: room.slug
	});
 
});

app.get("/rooms", middleware, async (_req, res) => {
	const rooms = await prisma.room.findMany({
		orderBy: {
			createdAt: "desc"
		},
		select: {
			id: true,
			slug: true,
			createdAt: true
		}
	});

	res.json({
		rooms
	});
});

app.get("/chats/:roomId", middleware, async (req, res) => {
	const roomId = Number(req.params.roomId);

	if (Number.isNaN(roomId)) {
		res.status(400).json({
			message: "Invalid room id"
		});
		return;
	}

	const chats = await prisma.chat.findMany({
		where: {
			roomId
		},
		orderBy: {
			id: "asc"
		},
		include: {
			user: {
				select: {
					id: true,
					name: true
				}
			}
		}
	});

	res.json({
		chats
	});
});

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
	console.log(`http-backend listening on http://localhost:${port}`);
});