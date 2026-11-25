package com.vilazuni.mobile;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int GREEN = Color.rgb(32, 60, 50);
    private static final int PAPER = Color.rgb(255, 253, 248);
    private WebView page;
    private int connectionAttempt;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(GREEN);
        getWindow().setNavigationBarColor(GREEN);
        String saved = savedOrigin();
        if (saved.isEmpty()) showAddress("", null);
        else connect(saved);
    }

    private String savedOrigin() {
        return getPreferences(MODE_PRIVATE).getString("origin", "");
    }

    private void showAddress(String previous, String message) {
        closePage();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(PAPER);
        LinearLayout contents = new LinearLayout(this);
        contents.setOrientation(LinearLayout.VERTICAL);
        contents.setPadding(dp(24), dp(32), dp(24), dp(24));
        scroll.addView(contents);
        text(contents, "Vilazuni", 32);
        text(contents, "Conectar ao condomínio", 22).setPadding(0, dp(18), 0, dp(6));
        text(contents, "Informe o endereço HTTPS do Vilazuni fornecido pela administração.", 15);

        EditText address = new EditText(this);
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint("Endereço HTTPS");
        address.setText(previous);
        address.setSingleLine(true);
        contents.addView(address, new LinearLayout.LayoutParams(-1, dp(54)));
        Button button = new Button(this);
        button.setText("Conectar");
        button.setOnClickListener(view -> connect(address.getText().toString()));
        contents.addView(button, new LinearLayout.LayoutParams(-1, dp(50)));
        if (message != null) text(contents, message, 15)
            .setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        setContentView(scroll);
    }

    private TextView text(LinearLayout content, String value, int size) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(GREEN);
        text.setTextSize(size);
        content.addView(text);
        return text;
    }

    static String verifiedOrigin(String raw, boolean rootOnly) {
        URI address = URI.create(raw.trim());
        String path = address.getRawPath();
        int port = address.getPort();
        if (!"https".equalsIgnoreCase(address.getScheme()) || address.getHost() == null ||
            address.getUserInfo() != null || port == 0 || port > 65535 ||
            (rootOnly && (address.getRawQuery() != null || address.getRawFragment() != null ||
                (path != null && !path.isEmpty() && !"/".equals(path))))) {
            throw new IllegalArgumentException("Endereço HTTPS inválido");
        }
        return "https://" + address.getHost().toLowerCase(Locale.ROOT) +
            (port == -1 || port == 443 ? "" : ":" + port);
    }

    private void connect(String raw) {
        final int attempt = ++connectionAttempt;
        final String origin;
        try {
            origin = verifiedOrigin(raw, true);
        } catch (IllegalArgumentException error) {
            showAddress(raw, "Informe o endereço HTTPS sem caminhos, parâmetros ou credenciais.");
            return;
        }
        showAddress(origin, "Verificando o endereço…");
        new Thread(() -> {
            boolean verified = hasVilazuni(origin);
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed() || attempt != connectionAttempt) return;
                if (!verified) {
                    showAddress(origin, "Não foi possível encontrar o Vilazuni v1 neste endereço.");
                    return;
                }
                getPreferences(MODE_PRIVATE).edit().putString("origin", origin).apply();
                showApp(origin);
            });
        }, "vilazuni-origin").start();
    }

    private boolean hasVilazuni(String origin) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(origin + "/").openConnection();
            connection.setConnectTimeout(7000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "text/html");
            if (connection.getResponseCode() != 200) return false;
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int size = 0;
                while (size < buffer.length) {
                    int count = input.read(buffer, size, buffer.length - size);
                    if (count < 0) break;
                    size += count;
                }
                return new String(buffer, 0, size, StandardCharsets.UTF_8)
                    .contains("<meta name=\"vilazuni-app\" content=\"v1\"");
            }
        } catch (Exception error) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void showApp(String origin) {
        closePage();
        page = new WebView(this);
        page.setBackgroundColor(PAPER);
        page.getSettings().setJavaScriptEnabled(true);
        page.getSettings().setDomStorageEnabled(true);
        page.getSettings().setAllowFileAccess(false);
        page.getSettings().setAllowContentAccess(false);
        page.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(page, false);
        page.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !sameOrigin(origin, request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (sameOrigin(origin, request.getUrl())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && view == page)
                    showAddress(origin, "O Vilazuni está indisponível. Tente conectar de novo.");
            }
        });
        setContentView(page);
        page.loadUrl(origin + "/");
    }

    private static boolean sameOrigin(String origin, Uri url) {
        try {
            return origin.equals(verifiedOrigin(url.toString(), false));
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    @Override
    public void onBackPressed() {
        if (page != null && page.canGoBack()) page.goBack();
        else if (page != null) showAddress(savedOrigin(), null);
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        closePage();
        super.onDestroy();
    }

    private void closePage() {
        if (page == null) return;
        if (page.getParent() instanceof ViewGroup) ((ViewGroup) page.getParent()).removeView(page);
        page.destroy();
        page = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
