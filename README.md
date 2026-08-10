# A-keyboard-editor

Grafischer Browser-Editor für das Tastaturlayout des privaten Android-Projekts `jpb-23/A-keyboard`.

Der Editor selbst ist öffentlich und enthält keine privaten Daten oder Zugangsdaten. Die Verbindung zum privaten Repository erfolgt im Browser über ein Fine-grained Personal Access Token.

## GitHub Pages aktivieren

1. Dieses Repository öffnen.
2. **Settings → Pages** öffnen.
3. Unter **Build and deployment** bei **Source** `Deploy from a branch` wählen.
4. Branch `main` und Ordner `/(root)` auswählen.
5. **Save** anklicken.

Danach ist der Editor normalerweise unter folgender Adresse erreichbar:

```text
https://jpb-23.github.io/A-keyboard-editor/
```

## Fine-grained Token anlegen

Für das direkte Laden und Speichern im privaten Repository sollte ein möglichst eng begrenztes Fine-grained Personal Access Token verwendet werden:

- Repository access: nur `jpb-23/A-keyboard`
- Repository permissions → Contents: `Read and write`

Das Token wird vom Editor nur im Arbeitsspeicher der geöffneten Browser-Seite gehalten. Es wird nicht in `localStorage` gespeichert und nicht in dieses öffentliche Repository geschrieben.

## Benutzung

1. Editor über GitHub Pages öffnen.
2. **GitHub verbinden** anklicken.
3. Fine-grained Token einfügen.
4. **Verbinden & laden** anklicken.
5. Ebene `ABC`, `123` oder `CODE` auswählen.
6. Eine Taste anklicken und rechts Beschriftung, Text/Funktion, Breite oder Darstellung bearbeiten.
7. Bei Bedarf Tasten, Zeilen oder Ebenen hinzufügen oder löschen.
8. **Im Repository speichern** anklicken.

Der Editor aktualisiert dann direkt:

```text
jpb-23/A-keyboard
└── app/src/main/assets/keyboard-layout.json
```

Der Commit auf `main` startet im privaten Repository automatisch den vorhandenen GitHub-Actions-Workflow und erzeugt eine neue APK.

## Sicherheit

Der Editor selbst enthält keinen GitHub-Token. Ein eingegebenes Token wird nicht persistent gespeichert. Beim Neuladen oder Schließen der Seite muss es erneut eingegeben werden.

Zusätzlich bleiben **JSON importieren** und **JSON exportieren** als manuelle Sicherungs-/Austauschmöglichkeit verfügbar.
