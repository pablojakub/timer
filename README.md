# Deep Work Timer

Aplikacja desktopowa do zarządzania sesjami głębokiej pracy (Deep Work) z wbudowanym timerem, odtwarzaczem muzyki i systemem śledzenia osiągnięć.

## Funkcjonalności

### Timer Deep Work
- Konfigurowalny timer (domyślnie 50 minut)
- Regulacja czasu strzałkami (±1 min, ±10 min)
- Pauza i wznawianie sesji
- Powiadomienia po zakończeniu sesji
- Automatyczna blokada uśpienia komputera podczas pracy
- Wizualizacja postępu za pomocą pierścienia

### Cele i osiągnięcia
- Ustawianie celu dla każdej sesji
- Potwierdzanie osiągnięcia celu po zakończeniu timera
- Lista dzisiejszych osiągnięć
- Animacja konfetti po potwierdzeniu sukcesu

### Licznik Streak (Dni z rzędu)
- Śledzenie dni roboczych (pon-pt) z osiągnięciami
- Weekendy nie przerywają ciągu
- Tolerancja jednego dnia opuszczenia
- Wyświetlanie aktualnego i najdłuższego streak'a
- Badge z licznikiem w prawym górnym rogu

### Odtwarzacz muzyki
- Wbudowana biblioteka muzyki do koncentracji z możliwością zapętlenia
- Kontrola głośności
- Automatyczne zatrzymanie po zakończeniu sesji

### Inne
- Dark mode

## Technologie

- **Electron** - Framework aplikacji desktopowej
- **JavaScript** - Logika aplikacji
- **HTML/CSS** - Interfejs użytkownika
- **Canvas Confetti** - Animacje konfetti

## Instalacja

### Wymagania
- Node.js (v18 lub nowszy)
- npm (v10 lub nowszy)

### Kroki instalacji

1. Sklonuj repozytorium lub pobierz pliki projektu

2. Zainstaluj zależności:
```bash
npm install
```

## Uruchomienie

### Tryb deweloperski
```bash
npm start
```

### Budowanie aplikacji
```bash
npm run build
```

Aplikacja zostanie zbudowana jako installer dla Windows w katalogu `dist/`.


Aplikacja została stworzona z myślą o metodzie Deep Work opisanej przez Cala Newporta i Atomic Habits Jamesa Cleara.

---

**Wersja:** 1.0.7
**Autor:** Paweł Jakubowski
