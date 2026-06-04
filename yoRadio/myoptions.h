// clang-format off
/* ===================================================================
   POPRAWKA PRZYCISKU DLA ENKODERA (KIERUNKI SĄ JUŻ OK)
   - KIERUNEK: Zachowany (W prawo głośniej - Pin 4, w lewo ciszej - Pin 2)
   - PRZYCISK: Przypisany jako główny przycisk systemowy (Pin 5)
   ===================================================================
*/

#ifndef myoptions_h
#define myoptions_h

#ifndef ARDUINO_ESP32S3_DEV
    #define ARDUINO_ESP32S3_DEV
#endif

/* Język interfejsu (Polski) */
#define L10N_LANGUAGE PL
#define USE_BUILTIN_LED false    
#define USE_OTA true              

/*----- 📺 WYŚWIETLACZ TFT (ILI9488 SPI) -----*/
#define DSP_MODEL DSP_ILI9488
#define TFT_CS         10
#define TFT_RST        9
#define TFT_DC         14
#define BRIGHTNESS_PIN 255       
#define SPI_FREQUENCY  40000000  

/*----- 🔊 PODŁĄCZENIE AUDIO -----*/
#define I2S_BCLK       16        
#define I2S_LRC        15        
#define I2S_DOUT       17        
#define PLAYER_FORCE_MONO true   
#define FIXED_VOLUME      255    
#define INITIAL_VOLUME    70     
#define MUTE_PIN          38     
#define MUTE_VAL          HIGH   

/*----- 🎛️ SYSTEM ENKODERA (KOREKTA PRZYCISKU 5) -----*/
#define REMOVE_AUDIO_CONTROLS  false       
#define PIN_AUTO_LOCK          false       

#define USR_PIN_COUNT          0    
#define EMUL_ENCODER           false 

// Sterownik typu 1 (Działa super z obrotami!)
#define ENC_TYPE               1    

// Główne piny systemowe wyłączone
#define ENC_A                  255
#define ENC_B                  255
#define ENC_KEY                255

// Kierunki obrotu (zostają tak, jak działały dobrze)
#define ENC_BTNL               2     // Lewo (Ciszej)
#define ENC_BTNR               4     // Prawo (Głośniej)

// !!! POPRAWKA: Przywracamy pin 5 jako główny przycisk enkodera !!!
#define ENC_BTNB               5     // Główne kliknięcie
#define ENC_BTNM               255   // Czyścimy alternatywne mapowanie, żeby nie blokowało pinu

// Druga sekcja wyłączona
#define ENC2_BTNL              255
#define ENC2_BTNR              255
#define ENC2_BTNB              255

// Parametry elektryczne dla czarnej płytki
#define BUTTONS_PULLUP         false     
#define BUTTONS_LEVEL          LOW      
#define ENC_HALF_STEP          false     
#define ENC_PHASE_DETECTION    true     

// Czyszczenie pozostałych przycisków
#define BTN_LEFT               255
#define BTN_CENTER             255
#define BTN_RIGHT              255
#define BTN_UP                 255
#define BTN_DOWN               255
#define BTN_MODE               255

/*----- 🔋 PASEK STANU I WIDŻETY -----*/
#define S_WIFI_SIGNAL          true    
#define FORCE_MONO_ICON        false   
#define BATT_PIN               255   
#define L_BATTERY              false 
#define CLOCK_TTS_ENABLED      false   
#define SDC_CS                 255   
#define EXT_WEATHER            false   
#define BOOMBOX_STYLE          false   
#define VU_PEAK                false 
#define ENABLE_STALL_WATCHDOG  true

#endif // myoptions_h