import { ApplicationCommandInputType, ApplicationCommandOptionType, Argument, CommandContext, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { UploadHandler, UploadManager, UserUtils } from "@webpack/common";
import cumImage from './cum.png';

const DEFAULT_RESOLUTION = 512;

function loadImage(source: File | string): Promise<HTMLImageElement> {
    const isFile = source instanceof File;
    const url = isFile ? URL.createObjectURL(source) : source;

    return new Promise((resolve, reject) => {
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

async function resolveImages(options: Argument[], ctx: CommandContext, noServerPfp: boolean): Promise<[HTMLImageElement, HTMLImageElement]> {
    let baseImage: HTMLImageElement;
    const overlayImage = await loadImage(cumImage);

    for (const opt of options) {
        switch (opt.name) {
            case "base":
                const upload = UploadManager.getUpload(ctx.channel.id, opt.name, DraftType.SlashCommand);
                if (upload && upload.isImage) {
                    baseImage = await loadImage(upload.item.file);
                } else if (typeof opt.value === "string") {
                    baseImage = await loadImage(opt.value);
                }
                break;
            case "user":
                try {
                    const user = await UserUtils.getUser(opt.value);
                    baseImage = await loadImage(user.getAvatarURL(noServerPfp ? void 0 : ctx.guild?.id, 2048).replace(/\?size=\d+$/, "?size=2048"));
                } catch (err) {
                    console.error("[overlay] Failed to fetch user\n", err);
                    UploadManager.clearAll(ctx.channel.id, DraftType.SlashCommand);
                    throw "Failed to fetch user. Check the console for more info.";
                }
        }
    }

    if (!baseImage) {
        UploadManager.clearAll(ctx.channel.id, DraftType.SlashCommand);
        throw "Base image must be specified";
    }

    return [baseImage, overlayImage];
}

export default definePlugin({
    name: "image-overlay",
    description: "Adds a /overlay slash command to combine two images",
    authors: [Devs.Ven],
    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "overlay",
            description: "Overlay an image onto another",
            options: [
                {
                    name: "resolution",
                    description: "Resolution for the output image. Defaults to 512.",
                    type: ApplicationCommandOptionType.INTEGER
                },
                {
                    name: "base",
                    description: "Base image attachment or URL",
                    type: ApplicationCommandOptionType.STRING
                },
                {
                    name: "user",
                    description: "User whose avatar to use as base image",
                    type: ApplicationCommandOptionType.USER
                },
                {
                    name: "no-server-pfp",
                    description: "Use the normal avatar instead of the server specific one when using the 'user' option",
                    type: ApplicationCommandOptionType.BOOLEAN
                }
            ],
            execute: async (opts, cmdCtx) => {
                const resolution = findOption(opts, "resolution", DEFAULT_RESOLUTION);
                const noServerPfp = findOption(opts, "no-server-pfp", false);

                try {
                    const [baseImage, overlayImage] = await resolveImages(opts, cmdCtx, noServerPfp);

                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = resolution;
                    const ctx = canvas.getContext("2d");

                    // Dessiner l'image de base
                    ctx.drawImage(baseImage, 0, 0, resolution, resolution);

                    // Dessiner l'image d'overlay au centre
                    const overlayWidth = Math.min(resolution, overlayImage.width);
                    const overlayHeight = Math.min(resolution, overlayImage.height);
                    const x = (resolution - overlayWidth) / 2;
                    const y = (resolution - overlayHeight) / 2;
                    ctx.drawImage(overlayImage, x, y, overlayWidth, overlayHeight);

                    // Convertir le canvas en fichier
                    const imageDataURL = canvas.toDataURL();
                    const file = await fetch(imageDataURL)
                        .then(response => response.blob())
                        .then(blob => new File([blob], "overlay.png", { type: "image/png" }));

                    UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);

                    setTimeout(() => UploadHandler.promptToUpload([file], cmdCtx.channel, DraftType.ChannelMessage), 10);
                } catch (err) {
                    UploadManager.clearAll(cmdCtx.channel.id, DraftType.SlashCommand);
                    sendBotMessage(cmdCtx.channel.id, {
                        content: String(err),
                    });
                }
            },
        },
    ]
});
