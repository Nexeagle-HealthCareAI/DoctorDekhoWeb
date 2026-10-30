// "Hey Vita" wake word: the microphone at 16 kHz in 1280-sample frames (80 ms), as the wake-word models expect. Runs in the
// browser's audio thread; nothing is recorded or sent anywhere from here. When the audio context runs at another rate (Firefox
// keeps the device rate), each output sample is the average of the input samples it covers, then posted to the page.
class WakeWordFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.frame = new Float32Array(1280);
    this.n = 0;
    this.acc = 0;
    this.count = 0;
    this.pos = 0;            // input samples consumed toward the next output sample
  }

  push(v) {
    this.frame[this.n++] = v;
    if (this.n === this.frame.length) {
      this.port.postMessage(this.frame.slice(0));
      this.n = 0;
    }
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    if (this.ratio === 1) {
      for (let i = 0; i < input.length; i++) this.push(input[i]);
      return true;
    }
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i];
      this.count++;
      this.pos++;
      if (this.pos >= this.ratio) {
        this.push(this.acc / this.count);
        this.acc = 0;
        this.count = 0;
        this.pos -= this.ratio;
      }
    }
    return true;
  }
}

registerProcessor("wake-word-frames", WakeWordFrames);
