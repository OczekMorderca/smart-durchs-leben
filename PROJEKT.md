# Dyktafon — dokumentacja projektu

## Czym jest aplikacja
PWA (Progressive Web App) — dyktafon z transkrypcją mowy, organizacją notatek w projekty/podprojekty, zdjęciami i eksportem do OneDrive.

## Adres aplikacji
```
https://OczekMorderca.github.io/smart-durchs-leben/
```

## Repozytorium GitHub
```
https://github.com/OczekMorderca/smart-durchs-leben
```
Branch roboczy: `claude/mobile-app-discussion-Kqj6Q`

## Stack techniczny
- **React + Vite** (frontend)
- **IndexedDB** via `idb` (lokalne przechowywanie danych)
- **Web Speech API** (transkrypcja głosu, język pl-PL)
- **Web Share API** (udostępnianie do OneDrive)
- **PWA** via `vite-plugin-pwa` (service worker, manifest)
- **GitHub Actions** → **GitHub Pages** (automatyczny deploy)

---

## Struktura plików

```
src/
├── App.jsx                  # Główny komponent, routing widoków
├── App.css                  # Wszystkie style
├── db/
│   └── index.js             # IndexedDB: projekty, podprojekty, notatki, zdjęcia
├── hooks/
│   ├── useSpeech.js         # Web Speech API (auto-restart, bez duplikacji)
│   └── useOneDrive.js       # (nieużywany — zastąpiony Web Share API)
└── components/
    ├── Sidebar.jsx           # Menu boczne (projekty/podprojekty), wysuwa się z prawej
    ├── Dictaphone.jsx        # Nagrywanie, transkrypcja, załączanie zdjęć
    ├── NoteList.jsx          # Lista notatek z miniaturami zdjęć, edycja
    └── OneDrivePanel.jsx     # Eksport TXT + zdjęcia przez Web Share API
```

---

## Baza danych (IndexedDB, wersja 2)

| Store        | Pola                                          |
|-------------|-----------------------------------------------|
| `projects`  | id, name, createdAt                           |
| `subprojects`| id, projectId, name, createdAt               |
| `notes`     | id, subprojectId, text, createdAt, updatedAt  |
| `photos`    | id, noteId, blob, mimeType, createdAt         |

Kaskadowe usuwanie: projekt → podprojekty → notatki → zdjęcia.

---

## Zaimplementowane funkcje

- [x] Nagrywanie głosu z transkrypcją (pl-PL, auto-restart po pauzie)
- [x] Struktura Projekt → Podprojekt → Notatki
- [x] Dodawanie/usuwanie projektów i podprojektów
- [x] Edycja i usuwanie notatek
- [x] Załączanie zdjęć do notatki (aparat lub galeria)
- [x] Miniatury zdjęć na liście notatek
- [x] Edycja zdjęć (dodaj/usuń w trybie edycji notatki)
- [x] Eksport TXT + zdjęcia przez menu "Udostępnij" Androida → OneDrive
- [x] Nazwy plików: `Projekt.Podprojekt_DD-MM-RRRR_HH-mm.txt`
- [x] Menu i przycisk Nagraj po prawej stronie (dla praworęcznych)
- [x] PWA — "Dodaj do ekranu głównego"
- [x] Tryb ciemny

---

## Deploy

GitHub Actions workflow: `.github/workflows/deploy.yml`
- Triggeruje się przy push na `claude/mobile-app-discussion-Kqj6Q`
- Buduje `npm run build` → publikuje `dist/` na branch `gh-pages`
- GitHub Pages serwuje z brancha `gh-pages`

---

## Znane ograniczenia

- Zdjęcia i notatki przechowywane tylko lokalnie w Chrome (IndexedDB)
- Wyczyszczenie danych przeglądarki usuwa wszystko → regularny eksport do OneDrive
- Web Share API działa tylko na Android/Chrome; na desktopie fallback = pobieranie pliku
- Automatyczna synchronizacja z OneDrive wymaga rejestracji aplikacji w Azure AD (Microsoft Graph API) — niezaimplementowane

---

## Planowane funkcje (do zrobienia)

- [ ] Automatyczna synchronizacja z OneDrive (Microsoft Graph API + MSAL)
- [ ] Wyszukiwanie po tekście notatek
- [ ] Zmiana nazwy projektu / podprojektu
- [ ] Przenoszenie notatki między podprojektami
- [ ] Eksport tylko bieżącego podprojektu
- [ ] Licznik czasu nagrywania
- [ ] Wysyłanie notatki mailem / WhatsApp

---

## Jak uruchomić lokalnie

```bash
git clone https://github.com/OczekMorderca/smart-durchs-leben
cd smart-durchs-leben
git checkout claude/mobile-app-discussion-Kqj6Q
npm install
npm run dev
# Otwórz http://localhost:5173 w Chrome
```

## Jak wdrożyć

```bash
git push origin claude/mobile-app-discussion-Kqj6Q
# GitHub Actions automatycznie buduje i wdraża
# Aplikacja dostępna po ~2 minutach
```
