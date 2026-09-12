# AgroFlux — aplicativo Android (APK)

A aplicação é **uma só**: as mesmas regras, o mesmo Firebase e as mesmas contas
rodam no navegador e dentro do aplicativo Android. O empacotamento usa
**Capacitor**, que embala o build web (`dist-web`) dentro de um app Android —
sem duplicar código e sem trocar de banco.

**Por que Capacitor:** preserva a aplicação existente, é compatível com o
Firebase via SDK web, gera APK e AAB, suporta celular e tablet, e abre acesso
aos recursos nativos (câmera, GPS, notificações) sem reescrever nada.

## O que já está pronto

- `capacitor.config.json` — id `br.com.usinapitangueiras.agroflux`, webDir `dist-web`.
- Plugins instalados: camera, geolocation, local-notifications, network, device.
- Camada nativa em `public/app/js/platform/native/` — no navegador usa as APIs
  da web; dentro do APK usa os plugins do Capacitor automaticamente.
- Interface de toque em `public/app/js/mobile/` e layout expandido para tablet.
- Fila offline em `public/app/js/preferences.js`.

## Requisitos

Node.js 18+, Java 17 e Android Studio (com Android SDK Platform 34).

## Gerar o APK

```bash
npm install
npm run android:add     # só na primeira vez — cria a pasta android/
npm run android:sync    # build web + copia para o Android
npm run android:apk     # APK de debug via Gradle
```

Saída: `android/app/build/outputs/apk/debug/app-debug.apk`.

Para abrir no Android Studio (Build → Build APK(s) / Generate Signed Bundle):

```bash
npm run android:open
```

A pasta `android/` **não é versionada** — ela é recriada por `npm run android:add`
a partir do `capacitor.config.json`, então o build continua reproduzível.

## Permissões (princípio do menor privilégio)

Peça no `android/app/src/main/AndroidManifest.xml` somente o que o app usa:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Nada de contatos, SMS, telefone ou armazenamento total.

## Celulares e tablets

Layout adaptativo pelo espaço disponível, não pelo aparelho:
celular → compacto; tablet → duas ou três colunas; desktop → completo.
Retrato e paisagem são suportados, com respeito às barras do sistema
(safe area) e ao teclado virtual.

## Assinatura de release

1. Gere a keystore **fora do repositório**:

```bash
keytool -genkey -v -keystore ~/agroflux-release.keystore \
  -alias agroflux -keyalg RSA -keysize 2048 -validity 10000
```

2. Crie `android/keystore.properties` (já ignorado pelo Git):

```properties
storeFile=/caminho/absoluto/agroflux-release.keystore
storePassword=...
keyAlias=agroflux
keyPassword=...
```

3. Gere:

```bash
npm run android:apk:release
# ou, para a Play Store:  cd android && ./gradlew bundleRelease
```

Keystore, senhas e certificados **nunca** vão para o GitHub. Em CI, use
GitHub Secrets.

## Atualização e cache

Cada `npm run build:web` carimba uma versão nova no service worker, então o
WebView do APK e o navegador não ficam presos numa versão antiga.
