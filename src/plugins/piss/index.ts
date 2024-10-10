/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, Argument, CommandContext, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { makeLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { DraftType, UploadHandler, UploadManager, UserUtils } from "@webpack/common";

const getLastFrame = makeLazy(() => loadImage("https://raw.githubusercontent.com/elfamosodemdem/MGEplugin/refs/heads/main/piss/piss.png"));

const UploadStore = findByPropsLazy("getUploads");

function loadImage(source: File | string) {
    const isFile = source instanceof File;
    const url = isFile ? URL.createObjectURL(source) : source;

    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (isFile)
                URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (event, _source, _lineno, _colno, err) => reject(err || event);
        img.crossOrigin = "Anonymous";
        img.src = url;
    });
}

async function resolveImage(options: Argument[], ctx: CommandContext, noServerPfp: boolean): Promise<File | string | null> {
    for (const opt of options) {
        switch (opt.name) {
            case "image":
                const upload = UploadStore.getUpload(ctx.channel.id, opt.name, DraftType.SlashCommand);
                if (upload) {
                    if (!upload.isImage) {
                        UploadManager.clearAll(ctx.channel.id, DraftType.SlashCommand);
                        throw "L'upload doit être une image.";
                    }
                    return upload.item.file;
                }
                break;
            case "url":
                return opt.value;
            case "user":
                try {
                    const user = await UserUtils.getUser(opt.value);
                    return user.getAvatarURL(noServerPfp ? void 0 : ctx.guild?.id, 2048).replace(/\?size=\d+$/, "?size=2048");
                } catch (err) {
                    console.error("[piss] Échec de récupération de l'utilisateur\n", err);
                    UploadManager.clearAll(ctx.channel.id, DraftType.SlashCommand);
                    throw "Impossible de récupérer l'utilisateur. Vérifiez la console pour plus d'infos.";
                }
        }
    }
    UploadManager.clearAll(ctx.channel.id, DraftType.SlashCommand);
    return null;
}

export default definePlugin({
    name: "piss",
    description: "Adds a /piss slash command to create piss images from any image",
    authors: [Devs.atomkern],
    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "piss",
            description: "Create a piss image. You can only specify one of the image options",
            options: [
                {
                    name: "image",
                    description: "Image attachment to use",
                    type: ApplicationCommandOptionType.ATTACHMENT
                },
                {
                    name: "url",
                    description: "URL to fetch image from",
                    type: ApplicationCommandOptionType.STRING
                },
                {
                    name: "user",
                    description: "User whose avatar to use as image",
                    type: ApplicationCommandOptionType.USER
                },
                {
                    name: "no-server-pfp",
                    description: "Use the normal avatar instead of the server specific one when using the 'user' option",
                    type: ApplicationCommandOptionType.BOOLEAN
                }
            ],
            execute: async (opts, cmdCtx) => {
                const lastFrame = await getLastFrame();

                const noServerPfp = findOption(opts, "no-server-pfp", false);
                try {
                    var url = await resolveImage(opts, cmdCtx, noServerPfp);
                    if (!url) throw "Aucune image spécifiée !";
                } catch (err) {
                    UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);
                    sendBotMessage(cmdCtx.channel.id, {
                        content: String(err),
                    });
                    return;
                }

                const avatar = await loadImage(url);

                let CANVAS_SIZE = 1024;
                if (avatar.width > CANVAS_SIZE || avatar.height > CANVAS_SIZE) {
                    CANVAS_SIZE = Math.max(avatar.width, avatar.height);
                }

                const canvas = document.createElement("canvas");
                canvas.width = CANVAS_SIZE;
                canvas.height = CANVAS_SIZE;
                const ctx = canvas.getContext("2d")!;

                UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);

                const scale = Math.min(CANVAS_SIZE / avatar.width, CANVAS_SIZE / avatar.height);
                const x = (CANVAS_SIZE - avatar.width * scale) / 2;
                const y = (CANVAS_SIZE - avatar.height * scale) / 2;

                ctx.drawImage(avatar, x, y, avatar.width * scale, avatar.height * scale);

                ctx.drawImage(lastFrame, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

                const imageDataURL = canvas.toDataURL("image/gif");
                const file = await fetch(imageDataURL).then(response => response.blob());
                const gifFile = new File([file], "piss.gif", { type: "image/gif" });

                setTimeout(() => UploadHandler.promptToUpload([gifFile], cmdCtx.channel, DraftType.ChannelMessage), 10);
            },
        }
    ]
});
