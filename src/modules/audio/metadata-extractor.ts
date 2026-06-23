import type { TTMLMetadata } from "$/types/ttml";

type ExtractedAudioMetadata = Partial<{
	musicName: string[];
	artists: string[];
	album: string[];
	songwriter: string[];
	isrc: string[];
}>;

const textDecoder = new TextDecoder();
const utf16Decoder = new TextDecoder("utf-16");
const utf16beDecoder = new TextDecoder("utf-16be");
const latin1Decoder = new TextDecoder("iso-8859-1");

const textFields = {
	TIT2: "musicName",
	TPE1: "artists",
	TALB: "album",
	TCOM: "songwriter",
	TSRC: "isrc",
	TT2: "musicName",
	TP1: "artists",
	TAL: "album",
	TCM: "songwriter",
	TRC: "isrc",
} as const;

const mp4Fields = {
	"\xa9nam": "musicName",
	"\xa9ART": "artists",
	aART: "artists",
	"\xa9alb": "album",
	"\xa9wrt": "songwriter",
} as const;

const vorbisFields = {
	TITLE: "musicName",
	ARTIST: "artists",
	ALBUMARTIST: "artists",
	ALBUM: "album",
	COMPOSER: "songwriter",
	ISRC: "isrc",
} as const;

const normalizeValue = (value: string) =>
	value.split("\0").join("\n").replace(/\s+/g, " ").trim();

const splitPeople = (value: string) =>
	value
		.split(/[\n;；、]/)
		.map(normalizeValue)
		.filter(Boolean);

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const addMetadataValue = (
	target: ExtractedAudioMetadata,
	key: keyof ExtractedAudioMetadata,
	value: string,
) => {
	const normalized = normalizeValue(value);
	if (!normalized) return;

	const nextValues =
		key === "artists" || key === "songwriter"
			? splitPeople(normalized)
			: [normalized];
	if (nextValues.length === 0) return;

	target[key] = uniqueValues([...(target[key] ?? []), ...nextValues]);
};

const synchsafeToInt = (bytes: Uint8Array, offset: number) =>
	(bytes[offset] << 21) |
	(bytes[offset + 1] << 14) |
	(bytes[offset + 2] << 7) |
	bytes[offset + 3];

const readUint24 = (view: DataView, offset: number) =>
	(view.getUint8(offset) << 16) |
	(view.getUint8(offset + 1) << 8) |
	view.getUint8(offset + 2);

const decodeId3Text = (frameData: Uint8Array) => {
	if (frameData.length === 0) return "";

	const encoding = frameData[0];
	const data = frameData.slice(1);

	if (encoding === 0) return latin1Decoder.decode(data);
	if (encoding === 1) return utf16Decoder.decode(data);
	if (encoding === 2) return utf16beDecoder.decode(data);
	return textDecoder.decode(data);
};

const extractId3v2Metadata = (buffer: ArrayBuffer): ExtractedAudioMetadata => {
	const bytes = new Uint8Array(buffer);
	if (
		bytes.length < 10 ||
		bytes[0] !== 0x49 ||
		bytes[1] !== 0x44 ||
		bytes[2] !== 0x33
	) {
		return {};
	}

	const metadata: ExtractedAudioMetadata = {};
	const version = bytes[3];
	const tagSize = synchsafeToInt(bytes, 6);
	const frameIdSize = version === 2 ? 3 : 4;
	const headerSize = version === 2 ? 6 : 10;
	let offset = 10;
	const end = Math.min(bytes.length, 10 + tagSize);
	const view = new DataView(buffer);

	while (offset + headerSize <= end) {
		const id = textDecoder.decode(bytes.slice(offset, offset + frameIdSize));
		if (!id.trim() || bytes[offset] === 0) break;

		const size =
			version === 2
				? readUint24(view, offset + 3)
				: version === 4
					? synchsafeToInt(bytes, offset + 4)
					: view.getUint32(offset + 4);

		const dataOffset = offset + headerSize;
		const dataEnd = dataOffset + size;
		if (size <= 0 || dataEnd > end) break;

		const key = textFields[id as keyof typeof textFields];
		if (key) {
			addMetadataValue(
				metadata,
				key,
				decodeId3Text(bytes.slice(dataOffset, dataEnd)),
			);
		}

		offset = dataEnd;
	}

	return metadata;
};

const readMp4BoxType = (bytes: Uint8Array, offset: number) =>
	textDecoder.decode(bytes.slice(offset + 4, offset + 8));

const readMp4Boxes = (
	bytes: Uint8Array,
	start: number,
	end: number,
	visit: (type: string, contentStart: number, contentEnd: number) => void,
) => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = start;

	while (offset + 8 <= end) {
		let size = view.getUint32(offset);
		const type = readMp4BoxType(bytes, offset);
		let headerSize = 8;

		if (size === 1 && offset + 16 <= end) {
			const high = view.getUint32(offset + 8);
			const low = view.getUint32(offset + 12);
			size = high * 2 ** 32 + low;
			headerSize = 16;
		} else if (size === 0) {
			size = end - offset;
		}

		if (size < headerSize || offset + size > end) break;

		visit(type, offset + headerSize, offset + size);
		offset += size;
	}
};

const extractMp4DataValue = (bytes: Uint8Array, start: number, end: number) => {
	let value = "";

	readMp4Boxes(bytes, start, end, (type, contentStart, contentEnd) => {
		if (type !== "data" || contentStart + 8 > contentEnd) return;
		value = textDecoder.decode(bytes.slice(contentStart + 8, contentEnd));
	});

	return value;
};

const extractMp4Metadata = (buffer: ArrayBuffer): ExtractedAudioMetadata => {
	const bytes = new Uint8Array(buffer);
	if (bytes.length < 12 || readMp4BoxType(bytes, 0) !== "ftyp") return {};

	const metadata: ExtractedAudioMetadata = {};
	const walk = (start: number, end: number, path: string[]) => {
		readMp4Boxes(bytes, start, end, (type, contentStart, contentEnd) => {
			const nextPath = [...path, type];

			if (path[path.length - 1] === "ilst") {
				const key = mp4Fields[type as keyof typeof mp4Fields];
				if (key) {
					addMetadataValue(
						metadata,
						key,
						extractMp4DataValue(bytes, contentStart, contentEnd),
					);
				}
				return;
			}

			if (type === "meta") {
				walk(contentStart + 4, contentEnd, nextPath);
				return;
			}

			if (
				type === "moov" ||
				type === "udta" ||
				type === "ilst" ||
				type === "trak" ||
				type === "mdia" ||
				type === "minf" ||
				type === "stbl"
			) {
				walk(contentStart, contentEnd, nextPath);
			}
		});
	};

	walk(0, bytes.length, []);
	return metadata;
};

const extractVorbisCommentBlock = (
	bytes: Uint8Array,
	start: number,
	end: number,
): ExtractedAudioMetadata => {
	const metadata: ExtractedAudioMetadata = {};
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = start;
	if (offset + 8 > end) return metadata;

	const vendorLength = view.getUint32(offset, true);
	offset += 4 + vendorLength;
	if (offset + 4 > end) return metadata;

	const commentCount = view.getUint32(offset, true);
	offset += 4;

	for (let i = 0; i < commentCount && offset + 4 <= end; i++) {
		const length = view.getUint32(offset, true);
		offset += 4;
		if (offset + length > end) break;

		const comment = textDecoder.decode(bytes.slice(offset, offset + length));
		const separatorIndex = comment.indexOf("=");
		if (separatorIndex > 0) {
			const rawKey = comment.slice(0, separatorIndex).toUpperCase();
			const key = vorbisFields[rawKey as keyof typeof vorbisFields];
			if (key)
				addMetadataValue(metadata, key, comment.slice(separatorIndex + 1));
		}
		offset += length;
	}

	return metadata;
};

const extractOggMetadata = (buffer: ArrayBuffer): ExtractedAudioMetadata => {
	const bytes = new Uint8Array(buffer);
	const metadata: ExtractedAudioMetadata = {};
	let offset = 0;
	let currentPacketParts: Uint8Array[] = [];

	const flushPacket = () => {
		if (currentPacketParts.length === 0) return;

		const packetLength = currentPacketParts.reduce(
			(length, part) => length + part.length,
			0,
		);
		const packet = new Uint8Array(packetLength);
		let packetOffset = 0;
		for (const part of currentPacketParts) {
			packet.set(part, packetOffset);
			packetOffset += part.length;
		}

		currentPacketParts = [];

		if (
			packet.length > 7 &&
			packet[0] === 0x03 &&
			textDecoder.decode(packet.slice(1, 7)) === "vorbis"
		) {
			const vorbisMetadata = extractVorbisCommentBlock(
				packet,
				7,
				packet.length,
			);
			for (const item of toTTMLMetadata(vorbisMetadata)) {
				for (const value of item.value) {
					addMetadataValue(
						metadata,
						item.key as keyof ExtractedAudioMetadata,
						value,
					);
				}
			}
		}

		if (
			packet.length > 8 &&
			textDecoder.decode(packet.slice(0, 8)) === "OpusTags"
		) {
			const opusMetadata = extractVorbisCommentBlock(packet, 8, packet.length);
			for (const item of toTTMLMetadata(opusMetadata)) {
				for (const value of item.value) {
					addMetadataValue(
						metadata,
						item.key as keyof ExtractedAudioMetadata,
						value,
					);
				}
			}
		}
	};

	while (offset + 27 <= bytes.length) {
		if (textDecoder.decode(bytes.slice(offset, offset + 4)) !== "OggS") break;

		const segmentCount = bytes[offset + 26];
		const segmentTableStart = offset + 27;
		const dataStart = segmentTableStart + segmentCount;
		if (dataStart > bytes.length) break;

		let pageDataOffset = dataStart;
		for (let i = 0; i < segmentCount; i++) {
			const segmentSize = bytes[segmentTableStart + i];
			const segmentEnd = pageDataOffset + segmentSize;
			if (segmentEnd > bytes.length) return metadata;

			currentPacketParts.push(bytes.slice(pageDataOffset, segmentEnd));
			pageDataOffset = segmentEnd;

			if (segmentSize < 255) flushPacket();
		}

		offset = pageDataOffset;
	}

	return metadata;
};

const extractFlacMetadata = (buffer: ArrayBuffer): ExtractedAudioMetadata => {
	const bytes = new Uint8Array(buffer);
	if (
		bytes.length < 4 ||
		bytes[0] !== 0x66 ||
		bytes[1] !== 0x4c ||
		bytes[2] !== 0x61 ||
		bytes[3] !== 0x43
	) {
		return {};
	}

	let offset = 4;
	while (offset + 4 <= bytes.length) {
		const blockType = bytes[offset] & 0x7f;
		const blockSize =
			(bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
		const contentStart = offset + 4;
		const contentEnd = contentStart + blockSize;
		if (contentEnd > bytes.length) break;

		if (blockType === 4) {
			return extractVorbisCommentBlock(bytes, contentStart, contentEnd);
		}

		offset = contentEnd;
	}

	return {};
};

const toTTMLMetadata = (metadata: ExtractedAudioMetadata): TTMLMetadata[] =>
	Object.entries(metadata)
		.map(([key, value]) => ({
			key,
			value: uniqueValues(value.filter((item) => item.trim() !== "")),
		}))
		.filter((item) => item.value.length > 0);

export async function extractAudioMetadata(
	file: File,
): Promise<TTMLMetadata[]> {
	const buffer = await file.arrayBuffer();
	const metadata = {
		...extractId3v2Metadata(buffer),
		...extractMp4Metadata(buffer),
		...extractFlacMetadata(buffer),
		...extractOggMetadata(buffer),
	};

	return toTTMLMetadata(metadata);
}
