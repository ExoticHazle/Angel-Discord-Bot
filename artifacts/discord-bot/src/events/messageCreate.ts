import { Events, type Message } from "discord.js";
import { recordActivity } from "../utils/gamification.js";

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    if (!message.guild || !message.member || message.author.bot) return;
    await recordActivity(message.guild, message.member, "messages", 1);
  },
};