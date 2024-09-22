import { Router } from "express";
import {
  connectUser,
  generatePasscode,
} from "../controller/connectionController";

const router = Router();

router.post("/generate-passcode", generatePasscode);
router.post("/connect/:passcode", connectUser);

export default router;
