export interface FFmpegWasmConfig {
	locateFile: (path: string, scriptDirectory: string) => string;
	js_get_file_size: (file_id: number) => number;
	js_read_file: (
		file_id: number,
		offset: number,
		length: number,
	) => ArrayBuffer | null;
}

export interface FFmpegWasmModule {
	wasmMemory: WebAssembly.Memory;

	_wasm_decoder_create(
		mode: number,
		sampleRate: number,
		channels: number,
	): number;
	_wasm_decoder_destroy(decoderPtr: number): number;

	_wasm_decoder_decode_frame(decoderPtr: number): number;
	_wasm_decoder_get_frame_samples(decoderPtr: number): number;
	_wasm_decoder_get_frame_min(decoderPtr: number): number;
	_wasm_decoder_get_frame_max(decoderPtr: number): number;
	_wasm_decoder_get_channel_ptr(
		decoderPtr: number,
		channelIndex: number,
	): number;
	_wasm_decoder_get_duration(decoderPtr: number): number;
	_wasm_decoder_seek(decoderPtr: number, targetSeconds: number): void;
	_wasm_decoder_get_metadata_json(decoderPtr: number): number;
	_wasm_decoder_get_cover_ptr(decoderPtr: number): number;
	_wasm_decoder_get_cover_size(decoderPtr: number): number;
	_wasm_decoder_get_cover_mime(decoderPtr: number): number;

	_wasm_decoder_set_compute_peaks(decoderPtr: number, enable: number): number;

	UTF8ToString(
		ptr: number,
		maxBytesToRead?: number,
		ignoreNul?: boolean,
	): string;
}

export type FFmpegWasmModuleFactory = (
	config: FFmpegWasmConfig,
) => Promise<FFmpegWasmModule>;
