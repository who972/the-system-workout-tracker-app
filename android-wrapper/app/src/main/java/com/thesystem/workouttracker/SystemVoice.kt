package com.thesystem.workouttracker

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/** Local speech only. Never falls back to a network recognition or synthesis service. */
class SystemVoice(private val activity: Activity, private val event: (String, String) -> Unit) {
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ready = false
    private var active = false
    private var pendingSpeech: String? = null
    fun available() = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
    fun listen() {
        stop()
        if (!available()) { event("error", "On-device recognition is unavailable. Use the text command field instead."); return }
        try {
            active = true
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity).also { engine ->
                engine.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) { if(active) event("listening", "Listening…") }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() { if(active) event("processing", "Processing on device…") }
                    override fun onError(error: Int) { if(active) { active=false; event("error", when(error) {
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is needed. You can also type a command."
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "I didn’t catch that. Tap Listen to try again, or type below."
                        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "Offline recognition for this language is unavailable. Install your phone’s speech language pack, or type below."
                        else -> "Offline recognition couldn’t finish. Try again or type a command."
                    }) } }
                    override fun onResults(results: Bundle?) { if(active) { active=false; val text=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty(); event(if(text.isBlank()) "error" else "result", if(text.isBlank()) "No speech detected. Try again." else text) } }
                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                engine.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                })
            }
        } catch (_: Exception) { active=false; event("error", "Offline recognition is unavailable. You can type below.") }
    }
    fun speak(text: String) {
        stop()
        if (tts == null) {
            pendingSpeech=text.take(1200)
            tts=TextToSpeech(activity) { status -> activity.runOnUiThread {
                val engine=tts
                val voice=engine?.voices?.firstOrNull { !it.isNetworkConnectionRequired && it.locale.language==Locale.getDefault().language }
                ready=status==TextToSpeech.SUCCESS && voice!=null
                if(ready && engine!=null) {
                    engine.voice=voice
                    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(id: String?) { activity.runOnUiThread { event("speaking", "Speaking…") } }
                        override fun onDone(id: String?) { activity.runOnUiThread { event("idle", "Ready") } }
                        @Deprecated("Android callback") override fun onError(id: String?) { activity.runOnUiThread { event("error", "Speech playback failed. Your answer is shown on screen.") } }
                    })
                    pendingSpeech?.let { say(it) };pendingSpeech=null
                } else { pendingSpeech=null;event("error", "No offline voice is installed for your language. Your answer is shown on screen.") }
            } }
        } else if(ready) say(text.take(1200)) else event("error", "Offline voice is not ready. Your answer is shown on screen.")
    }
    private fun say(text: String) { if(tts?.speak(text,TextToSpeech.QUEUE_FLUSH,null,"system-reply") == TextToSpeech.ERROR) event("error","Speech playback failed. Your answer is shown on screen.") }
    fun stop() { active=false;pendingSpeech=null;recognizer?.cancel();recognizer?.destroy();recognizer=null;tts?.stop() }
    fun close() { stop();tts?.shutdown();tts=null;ready=false }
}
