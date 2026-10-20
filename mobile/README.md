# Aplicativos Vilazuni

O mesmo serviço central e as mesmas permissões atendem navegador e celular. A versão completa depende do endereço HTTPS que será escolhido na fase de hospedagem. Não há domínio ou assinatura de loja inventados nos projetos.

## Instalação imediata após hospedar

Android: abrir a aplicação no navegador e usar **Celular → Instalar neste dispositivo**, ou o menu de instalação. iPhone/iPad: Safari → Compartilhar → Adicionar à Tela de Início. Avisos web push no iOS exigem versão compatível e aplicação instalada na tela inicial. Sem rede, a interface pública pode abrir, mas operações privadas exigem conexão.

## Android

Projeto em `android/`: Gradle 8.9, Android Gradle Plugin 8.7.3, Java 17, compile/target SDK 35, mínimo 23, Android Browser Helper 2.6.2. TWA reutiliza o PWA no navegador do aparelho; domínio não verificado utiliza a alternativa de aba do navegador. Não há senha, segredo de servidor ou bridge JavaScript nativa no pacote.

```sh
cd mobile/android
VILAZUNI_ORIGIN=https://seu-dominio.example gradle assembleDebug
```

`app/build/outputs/apk/debug/app-debug.apk` é um pacote **de avaliação**, assinado com chave de depuração. A origem de teste padrão `https://example.invalid` só permite verificar compilação; não é endereço de acesso ao condomínio. O workflow **Pacotes móveis** aceita a origem HTTPS e disponibiliza artefato temporário do APK em Actions.

Para distribuição: domínio HTTPS real, certificado de assinatura próprio/Play App Signing, geração release/AAB, identificação do aplicativo e `ANDROID_SHA256_CERT_FINGERPRINTS` no servidor para `/.well-known/assetlinks.json`. Guardar o keystore fora do Git; definir versão e política de publicação. Conferir sessão, downloads, upload de evidências, câmera do aparelho/navegador, teclado, passeio e avisos em Android físico.

## iPhone/iPad

Projeto declarativo XcodeGen em `ios/project.yml`, SwiftUI e SafariServices, iOS 16.4+. O contêiner abre a mesma origem HTTPS pelo navegador incorporado de sistema. Não implementa push nativo; para avisos web no iOS, usar o PWA instalado. Nenhuma credencial fica embutida.

Em macOS com Xcode e XcodeGen:

```sh
cd mobile/ios
xcodegen generate
xcodebuild -project Vilazuni.xcodeproj -scheme Vilazuni -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO VILAZUNI_ORIGIN=https://seu-dominio.example build
```

O workflow valida a compilação do simulador em macOS. Esse `.app` não é um IPA instalável em iPhone. Distribuição em aparelho exige conta Apple, equipe/certificados/perfis e arquivo de distribuição/TestFlight. Avaliar os critérios da App Store para o formato final; compilação não garante aceitação da loja. Homologar em aparelho e decidir se o PWA atende a distribuição inicial.

## Privacidade e validação

Service worker guarda somente arquivos públicos. API, documentos, evidências e credenciais não entram no cache. Notificação contém aviso genérico e abre o aplicativo com autenticação. Aplicativos não recebem URL arbitrária de comando físico e não contêm chaves de PostgreSQL, modelo, bot, câmera ou portão.

Os builds automatizados, testes de navegador e simuladores comprovam o escopo técnico. Assinatura, links públicos de download, contas de loja, endereço final e homologação física serão definidos na fase operacional seguinte solicitada pelo usuário.
