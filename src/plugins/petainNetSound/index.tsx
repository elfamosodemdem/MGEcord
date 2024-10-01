/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { makeRange } from "@components/PluginSettings/components/SettingSliderComponent";
import { Devs } from "@utils/constants";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { RelationshipStore, SelectedChannelStore, UserStore } from "@webpack/common";
import { Message, ReactionEmoji } from "discord-types/general";

interface IMessageCreate {
    type: "MESSAGE_CREATE";
    optimistic: boolean;
    isPushNotification: boolean;
    channelId: string;
    message: Message;
}

interface IReactionAdd {
    type: "MESSAGE_REACTION_ADD";
    optimistic: boolean;
    channelId: string;
    messageId: string;
    messageAuthorId: string;
    userId: "195136840355807232";
    emoji: ReactionEmoji;
}

interface IVoiceChannelEffectSendEvent {
    type: string;
    emoji?: ReactionEmoji; // Just in case...
    channelId: string;
    userId: string;
    animationType: number;
    animationId: number;
}

const PETAINNET = "petain.net";
const PETAINNET_URL =
    "https://github.com/elfamosodemdem/MGEplugin/raw/refs/heads/main/PetainNetSound/imsmarter.mp3";
const PETAINNET_URL_HD =
    "https://github.com/elfamosodemdem/MGEplugin/raw/refs/heads/main/PetainNetSound/imsmarter.mp3";

const settings = definePluginSettings({
    volume: {
        description: "Volume du son",
        type: OptionType.SLIDER,
        markers: makeRange(0, 1, 0.1),
        default: 0.5,
        stickToMarkers: false
    },
    quality: {
        description: "Qualité du son",
        type: OptionType.SELECT,
        options: [
            { label: "Normal", value: "Normal", default: true },
            { label: "HD", value: "HD" }
        ],
    },
    triggerWhenUnfocused: {
        description: "Déclencher le son même quand la fenêtre n'est pas au premier plan",
        type: OptionType.BOOLEAN,
        default: true
    },
    ignoreBots: {
        description: "Ignorer les bots",
        type: OptionType.BOOLEAN,
        default: true
    },
    ignoreBlocked: {
        description: "Ignorer les utilisateurs bloqués",
        type: OptionType.BOOLEAN,
        default: true
    }
});

export default definePlugin({
    name: "PetainNetSound",
    authors: [Devs.atomkern],
    description: "Joue un son lorsqu'on écrit \"petain.net\"",
    settings,

    flux: {
        async MESSAGE_CREATE({ optimistic, type, message, channelId }: IMessageCreate) {
            if (optimistic || type !== "MESSAGE_CREATE") return;
            if (message.state === "SENDING") return;
            if (settings.store.ignoreBots && message.author?.bot) return;
            if (settings.store.ignoreBlocked && RelationshipStore.isBlocked(message.author?.id)) return;
            if (!message.content) return;
            if (channelId !== SelectedChannelStore.getChannelId()) return;

            const petainNetCount = getPetainNetCount(message.content);

            for (let i = 0; i < petainNetCount; i++) {
                boom();
                await sleep(300);
            }
        },

        MESSAGE_REACTION_ADD({ optimistic, type, channelId, userId, messageAuthorId, emoji }: IReactionAdd) {
            if (optimistic || type !== "MESSAGE_REACTION_ADD") return;
            if (settings.store.ignoreBots && UserStore.getUser(userId)?.bot) return;
            if (settings.store.ignoreBlocked && RelationshipStore.isBlocked(messageAuthorId)) return;
            if (channelId !== SelectedChannelStore.getChannelId()) return;

            const name = emoji.name?.toLowerCase();
            if (!name || !name.includes("petain") && !name.includes("net")) return;

            boom();
        },

        VOICE_CHANNEL_EFFECT_SEND({ emoji }: IVoiceChannelEffectSendEvent) {
            if (!emoji?.name) return;
            const name = emoji.name.toLowerCase();
            if (!name.includes("petain") && !name.includes("net")) return;

            boom();
        },
    }
});

function countOccurrences(sourceString: string, subString: string) {
    let i = 0;
    let lastIdx = 0;
    while ((lastIdx = sourceString.indexOf(subString, lastIdx) + 1) !== 0)
        i++;

    return i;
}

function countMatches(sourceString: string, pattern: RegExp) {
    if (!pattern.global)
        throw new Error("pattern must be global");

    let i = 0;
    while (pattern.test(sourceString))
        i++;

    return i;
}

const customPetainNetRe = /<a?:\w*petain\w*net\w*:\d{17,20}>/gi;

function getPetainNetCount(message: string) {
    const lowerCaseMessage = message.toLowerCase();
    const count = countOccurrences(lowerCaseMessage, PETAINNET.toLowerCase())
        + countMatches(lowerCaseMessage, customPetainNetRe);

    return Math.min(count, 10);
}


function boom() {
    if (!settings.store.triggerWhenUnfocused && !document.hasFocus()) return;
    const audioElement = document.createElement("audio");

    audioElement.src = settings.store.quality === "HD"
        ? PETAINNET_URL_HD
        : PETAINNET_URL;

    audioElement.volume = settings.store.volume;
    audioElement.play();
}
