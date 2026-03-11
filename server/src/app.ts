import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { routes } from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { requestId } from "./middlewares/requestId";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use(requestId);
app.use(morgan("dev"));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);