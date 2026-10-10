import { Events, type VoiceState } from "discord.js";
import { observeVoiceStateUpdate } from "../utils/scheduler.js";

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  execute(previous: VoiceState, current: VoiceState) {
    observeVoiceStateUpdate(previous, current);
  },
};
