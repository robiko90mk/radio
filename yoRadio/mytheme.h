#ifndef _my_theme_h
#define _my_theme_h

#define ENABLE_THEME
#ifdef  ENABLE_THEME

/* Paleta barw "Modern Neon Dark" dla ekranu 480x320 */
#define COLOR_BACKGROUND         10,15,28    /* Głęboki, nowoczesny ciemnogranatowy */
#define COLOR_STATION_NAME      255,255,255  /* Biały napis stacji */
#define COLOR_STATION_BG         31,43,74    /* Zaokrąglona belka górna (grafit/granat) */
#define COLOR_STATION_FILL       45,61,102   
#define COLOR_SNG_TITLE_1       255,255,255  /* Wykonawca (Czysty biały) */
#define COLOR_SNG_TITLE_2       0,229,180    /* Tytuł piosenki (Modern Turkus / Neon Cyan) */
#define COLOR_CLOCK             255,255,255  
#define COLOR_CLOCK_BG           20,28,48    
#define COLOR_SECONDS           0,229,180    /* Sekundy w kolorze neonu */
#define COLOR_DAY_OF_W          140,155,185  /* Data w stonowanym, nowoczesnym szarym */
#define COLOR_DATE              140,155,185  
#define COLOR_VOLUME_VALUE      0,229,180    
#define COLOR_IP                100,120,150  

/* Kolorystyka animowanej fali dźwiękowej na dole */
#define COLOR_VU_MIN            0,120,255    /* Początek fali: Głęboki błękit */
#define COLOR_VU_MAX            255,60,120   /* Szczyty fali: Neonowy róż / magenta */
#define COLOR_VOLBAR_IN         0,229,180    /* Pasek głośności w kolorze turkusu */
#define COLOR_VOLBAR_OUT         45,61,102   

#endif 
#endif