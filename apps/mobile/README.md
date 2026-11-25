# Vilazuni v1 no Android

Este build de avaliação abre a interface web responsiva da v1. A sessão usa o fluxo web da mesma origem da API. O APK pede o endereço HTTPS do condomínio na primeira abertura e verifica o marcador da v1 no documento inicial.

## Compilar no Windows

Requer Python 3, Java 17, SDK Android com plataforma API 34 ou superior e Android Build Tools. Defina `JAVA_HOME` e `ANDROID_HOME`.

```powershell
python apps/mobile/build-apk.py
```

O resultado fica em `apps/mobile/dist/Vilazuni_Android.apk`. A chave local de avaliação fica em `apps/mobile/android/`. O mesmo instalador serve para mais de um condomínio. Na primeira abertura, informe a origem HTTPS da instalação da v1, sem caminhos. Voltar a partir da primeira tela do app reabre a configuração de endereço.

A publicação da v1 precisa servir `apps/web/dist` na origem HTTPS escolhida, encaminhar `/api/v1` à API e devolver a página inicial para rotas do app. Configure essa origem em `ALLOWED_ORIGINS` e mantenha o cookie seguro. A assinatura e os fluxos de sessão nativa da distribuição definitiva ficam na etapa F1.5.
