import { Events, type VoiceState } from "discord.js";
import { observeVoiceStateUpdate } from "../utils/scheduler.js";

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(previous: VoiceState, current: VoiceState) {
    await observeVoiceStateUpdate(previous, current);
  },
};
