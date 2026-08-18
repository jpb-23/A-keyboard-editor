# A-keyboard-editor

Grafischer Browser-Editor für das Tastaturlayout des privaten Android-Projekts `jpb-23/A-keyboard`.

Der Editor ist über GitHub Pages erreichbar:

```text
https://jpb-23.github.io/A-keyboard-editor/
```

## Verbindung zum privaten Repository

Der Editor selbst ist öffentlich und enthält keine privaten Zugangsdaten. Für das direkte Laden und Speichern wird im Browser ein Fine-grained Personal Access Token verwendet.

Empfohlene Token-Berechtigung:

- Repository access: nur `jpb-23/A-keyboard`
- Repository permissions → Contents: `Read and write`

Das Token bleibt nur im Arbeitsspeicher der geöffneten Browser-Seite und wird nicht in `localStorage` gespeichert.

## Bearbeitbare Tasteneigenschaften

Für jede Taste können unter anderem eingestellt werden:

- Beschriftung
- ausgegebener Text oder Funktion
- Ziel-Ebene
- Breite
- Stil `Normal`, `Funktion` oder `Akzent`
- eigene Tastenfarbe
- eigene Textfarbe
- eigenes Bild-Icon als PNG, JPG oder WebP
- Wiederholung bei Gedrückthalten

Bild-Icons sind auf 64 KB pro Taste begrenzt. Sie werden als Data-URL direkt in `keyboard-layout.json` gespeichert. Dadurch braucht die Android-App keine zusätzlichen Icon-Dateien.

## Emoji-Ebene

Die Ebene `emoji` mit der Beschriftung `😊 Emoji` gehört zur erweiterten Tastatur. Bei älteren Layout-Dateien wird sie automatisch ergänzt. Sie kann anschließend wie andere Ebenen grafisch bearbeitet werden.

Zusätzlich werden bei den Ebenen `ABC`, `123` und `CODE` automatisch Emoji-Wechseltasten ergänzt, falls sie dort noch fehlen.

## Wiederholen beim Gedrückthalten

`Delete`, Cursor links und Cursor rechts sind standardmäßig als wiederholbar markiert. Im Editor kann die Option **Bei Gedrückthalten wiederholen** auch für normale Texttasten aktiviert werden.

## Wortvorschläge

Die Wortvorschläge werden nicht im Browser-Editor berechnet, sondern in der Android-Tastatur. Auf der ABC-Ebene erscheint oberhalb der Tasten eine Vorschlagsleiste mit bis zu drei Treffern für den aktuellen Wortanfang.

Die Vorschläge arbeiten lokal/offline aus dem im Android-Projekt enthaltenen Wörterbuch. Passwortfelder erhalten keine Vorschläge.

## Benutzung

1. Editor über GitHub Pages öffnen.
2. **GitHub verbinden** anklicken.
3. Fine-grained Token einfügen.
4. **Verbinden & laden** anklicken.
5. Ebene auswählen.
6. Taste anklicken und rechts bearbeiten.
7. **Im Repository speichern** anklicken.

Der Editor aktualisiert direkt:

```text
jpb-23/A-keyboard
└── app/src/main/assets/keyboard-layout.json
```

Der Commit auf `main` startet im privaten Repository den GitHub-Actions-Workflow für die signierte APK.

`JSON importieren` und `JSON exportieren` bleiben zusätzlich als manuelle Sicherungs- und Austauschmöglichkeit verfügbar.
