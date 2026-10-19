/* ==========================================================================
   NESTOR FREIRE — comportamento do site
   JavaScript puro, sem bibliotecas externas.

   Regra que guia este arquivo: o site precisa funcionar mesmo sem
   JavaScript. Tudo aqui é melhoria, nunca requisito.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Atalhos
     ------------------------------------------------------------------ */

  var $  = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  };


  /* ==================================================================
     1. ANO NO RODAPÉ
     ================================================================== */

  var ano = $("#ano");
  if (ano) { ano.textContent = String(new Date().getFullYear()); }


  /* ==================================================================
     2. MENU NO CELULAR
     ================================================================== */

  var menuBotao = $(".menu-botao");
  var menu = $("#menu-principal");

  if (menuBotao && menu) {
    menuBotao.addEventListener("click", function () {
      var aberto = menuBotao.getAttribute("aria-expanded") === "true";
      menuBotao.setAttribute("aria-expanded", String(!aberto));
      menu.setAttribute("data-aberto", aberto ? "nao" : "sim");
      $(".sr-apenas", menuBotao).textContent = aberto ? "Abrir menu" : "Fechar menu";
    });

    // Ao escolher um item, o menu se fecha sozinho.
    menu.addEventListener("click", function (evento) {
      if (evento.target.closest("a")) {
        menuBotao.setAttribute("aria-expanded", "false");
        menu.setAttribute("data-aberto", "nao");
      }
    });
  }


  /* ==================================================================
     3. SOBREPOSIÇÕES — base comum ao leitor e à lente

     Enquanto uma sobreposição está aberta:
       · o resto da página fica inerte (fora do Tab e dos leitores de tela);
       · a rolagem de fundo é travada;
       · Esc fecha;
       · ao fechar, o foco volta para onde estava.
     ================================================================== */

  var focoAnterior = null;
  var rolagemTravada = false;

  function irmaosDaSobreposicao(sobreposicao) {
    return $$("body > *").filter(function (no) { return no !== sobreposicao; });
  }

  function travarFundo(sobreposicao) {
    irmaosDaSobreposicao(sobreposicao).forEach(function (no) {
      no.inert = true;
      no.setAttribute("aria-hidden", "true");
    });

    if (!rolagemTravada) {
      var folga = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (folga > 0) { document.body.style.paddingRight = folga + "px"; }
      rolagemTravada = true;
    }
  }

  function liberarFundo(sobreposicao) {
    irmaosDaSobreposicao(sobreposicao).forEach(function (no) {
      no.inert = false;
      no.removeAttribute("aria-hidden");
    });

    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    rolagemTravada = false;
  }

  var FOCAVEIS = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Rede de segurança para navegadores sem suporte a "inert".
  function prenderFoco(painel, evento) {
    if (evento.key !== "Tab") { return; }

    var alvos = $$(FOCAVEIS, painel).filter(function (no) {
      return no.offsetParent !== null || no === document.activeElement;
    });
    if (!alvos.length) { return; }

    var primeiro = alvos[0];
    var ultimo = alvos[alvos.length - 1];

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }


  /* ==================================================================
     4. LEITOR DE ARTIGO

     As fichas da seção "Artigos" são geradas a partir dos <article>
     que estão na Biblioteca. Assim existe uma única fonte de verdade:
     para publicar um texto novo basta acrescentar um <article> no HTML.
     ================================================================== */

  var biblioteca = $("#biblioteca");
  var lista = $("#lista-artigos");
  var leitor = $("#leitor");
  var leitorPainel = leitor ? $(".leitor__painel", leitor) : null;
  var leitorConteudo = $("#leitor-conteudo");
  var leitorBarra = $("#leitor-progresso");

  var artigos = biblioteca ? $$(".artigo", biblioteca) : [];
  var leitorAberto = false;

  function dataDoArtigo(artigo) {
    var tempo = $("time[datetime]", artigo);
    return tempo ? tempo.getAttribute("datetime") : "";
  }

  function textoDe(artigo, seletor) {
    var no = $(seletor, artigo);
    return no ? no.textContent.trim() : "";
  }

  function montarFichas() {
    if (!lista || !artigos.length) { return; }

    // Mais recentes primeiro.
    var ordenados = artigos.slice().sort(function (a, b) {
      return dataDoArtigo(b).localeCompare(dataDoArtigo(a));
    });

    var fragmento = document.createDocumentFragment();

    ordenados.forEach(function (artigo) {
      var item = document.createElement("li");
      item.className = "ficha";

      var gatilho = document.createElement("button");
      gatilho.type = "button";
      gatilho.className = "ficha__gatilho";
      gatilho.setAttribute("data-artigo", artigo.id);

      var meta = document.createElement("p");
      meta.className = "ficha__meta";
      meta.textContent = textoDe(artigo, ".artigo__meta");

      var titulo = document.createElement("h3");
      titulo.className = "ficha__titulo";
      titulo.textContent = textoDe(artigo, ".artigo__titulo");

      // Título em outro idioma (lang="en") continua marcado na ficha.
      var tituloOriginal = $(".artigo__titulo", artigo);
      if (tituloOriginal && tituloOriginal.lang) { titulo.lang = tituloOriginal.lang; }

      var resumo = document.createElement("p");
      resumo.className = "ficha__resumo";
      resumo.textContent = textoDe(artigo, ".artigo__resumo");

      var acao = document.createElement("span");
      acao.className = "ficha__acao";
      acao.textContent = artigo.getAttribute("data-acao") || "Ler o artigo";

      if (meta.textContent) { gatilho.appendChild(meta); }
      gatilho.appendChild(titulo);
      if (resumo.textContent) { gatilho.appendChild(resumo); }
      gatilho.appendChild(acao);

      item.appendChild(gatilho);
      fragmento.appendChild(item);
    });

    lista.appendChild(fragmento);
  }

  function abrirLeitor(id, empilharHistorico) {
    var artigo = document.getElementById(id);
    if (!artigo || !leitor || !leitorConteudo) { return; }

    focoAnterior = document.activeElement;

    // Trabalhamos sobre uma cópia: o original permanece intacto na
    // Biblioteca, servindo de fonte para as fichas e para quem está sem JS.
    var copia = artigo.cloneNode(true);
    copia.removeAttribute("id");

    // O título da cópia passa a nomear a janela para os leitores de tela.
    var tituloCopia = $(".artigo__titulo", copia);
    if (tituloCopia) {
      tituloCopia.id = "leitor-titulo-atual";
      leitorPainel.setAttribute("aria-labelledby", "leitor-titulo-atual");
    }

    leitorConteudo.innerHTML = "";
    leitorConteudo.appendChild(copia);

    leitor.hidden = false;
    leitorAberto = true;
    travarFundo(leitor);

    leitorConteudo.scrollTop = 0;
    atualizarProgresso();
    leitorPainel.focus();

    if (empilharHistorico) {
      try {
        history.pushState({ leitor: id }, "", "#" + id);
      } catch (erro) { /* navegação sem histórico: segue sem o atalho */ }
    }
  }

  function fecharLeitorDeFato() {
    if (!leitorAberto) { return; }

    leitor.hidden = true;
    leitorAberto = false;
    liberarFundo(leitor);
    leitorConteudo.innerHTML = "";
    leitorPainel.setAttribute("aria-labelledby", "leitor-rotulo");

    if (focoAnterior && document.contains(focoAnterior)) {
      focoAnterior.focus();
    }
    focoAnterior = null;
  }

  function fecharLeitor() {
    // Se o leitor entrou no histórico, voltar mantém a URL coerente.
    if (history.state && history.state.leitor) {
      history.back();
      return;
    }
    if (location.hash) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (erro) { /* silencioso */ }
    }
    fecharLeitorDeFato();
  }

  function atualizarProgresso() {
    if (!leitorBarra || !leitorConteudo) { return; }
    var percorrivel = leitorConteudo.scrollHeight - leitorConteudo.clientHeight;
    var razao = percorrivel > 0 ? leitorConteudo.scrollTop / percorrivel : 0;
    leitorBarra.style.width = Math.min(100, Math.max(0, razao * 100)) + "%";
  }

  if (leitor && lista) {
    montarFichas();

    lista.addEventListener("click", function (evento) {
      var gatilho = evento.target.closest("[data-artigo]");
      if (gatilho) { abrirLeitor(gatilho.getAttribute("data-artigo"), true); }
    });

    $$("[data-fechar]", leitor).forEach(function (no) {
      no.addEventListener("click", fecharLeitor);
    });

    leitorConteudo.addEventListener("scroll", atualizarProgresso, { passive: true });

    window.addEventListener("popstate", fecharLeitorDeFato);

    // Link direto para um artigo: profnestorfreire.com.br/#artigo-...
    if (location.hash.indexOf("#artigo-") === 0) {
      abrirLeitor(location.hash.slice(1), false);
    }
  }


  /* ==================================================================
     5. AMPLIAÇÃO DAS FOTOS DE QUADRO
     ================================================================== */

  var lente = $("#lente");
  var lentePainel = lente ? $(".lente__painel", lente) : null;
  var lenteImagem = $("#lente-imagem");
  var lenteLegenda = $("#lente-legenda");
  var lenteAberta = false;

  function abrirLente(gatilho) {
    var imagem = $("img", gatilho);
    if (!imagem || !lente) { return; }

    var figura = gatilho.closest("figure");
    var legenda = figura ? $("figcaption", figura) : null;

    focoAnterior = document.activeElement;

    // data-grande permite servir uma versão maior só na ampliação.
    lenteImagem.src = imagem.getAttribute("data-grande") || imagem.currentSrc || imagem.src;
    lenteImagem.alt = imagem.alt || "";
    lenteLegenda.textContent = legenda ? legenda.textContent.trim() : "";

    lente.hidden = false;
    lenteAberta = true;
    travarFundo(lente);
    lentePainel.focus();
  }

  function fecharLente() {
    if (!lenteAberta) { return; }

    lente.hidden = true;
    lenteAberta = false;
    liberarFundo(lente);
    lenteImagem.removeAttribute("src");
    lenteLegenda.textContent = "";

    if (focoAnterior && document.contains(focoAnterior)) { focoAnterior.focus(); }
    focoAnterior = null;
  }

  if (lente) {
    document.addEventListener("click", function (evento) {
      var gatilho = evento.target.closest(".quadro__gatilho");
      if (gatilho) { abrirLente(gatilho); }
    });

    $$("[data-fechar]", lente).forEach(function (no) {
      no.addEventListener("click", fecharLente);
    });
  }


  /* ==================================================================
     6. TECLADO
     ================================================================== */

  document.addEventListener("keydown", function (evento) {
    if (lenteAberta) {
      if (evento.key === "Escape") { fecharLente(); }
      else { prenderFoco(lentePainel, evento); }
      return;
    }

    if (leitorAberto) {
      if (evento.key === "Escape") { fecharLeitor(); }
      else { prenderFoco(leitorPainel, evento); }
    }
  });


  /* ==================================================================
     7. CONTATO — o aviso some assim que houver um dado preenchido
     ================================================================== */

  var aviso = $("#contato-aviso");
  var listaContato = $(".contato");

  if (aviso && listaContato) {
    var visiveis = $$(".contato__item", listaContato).filter(function (item) {
      return !item.hasAttribute("hidden");
    });

    if (visiveis.length) { aviso.hidden = true; }
    else { listaContato.hidden = true; }
  }


  /* ==================================================================
     8. MODO CLARO / ESCURO

     O tema inicial já foi aplicado por um script no <head>, antes de a
     página pintar. Aqui fica só o botão. O padrão é claro; a escolha do
     visitante fica guardada no navegador dele para as próximas visitas.
     ================================================================== */

  var raiz = document.documentElement;
  var temaBotao = $(".tema-botao");
  var corDoNavegador = $('meta[name="theme-color"]');

  function aplicarTema(tema) {
    var escuro = tema === "escuro";
    raiz.setAttribute("data-tema", escuro ? "escuro" : "claro");

    if (temaBotao) {
      temaBotao.setAttribute("aria-pressed", String(escuro));
      temaBotao.title = escuro ? "Voltar ao modo claro" : "Ativar o modo escuro";
    }
    // Cor da barra do navegador no celular.
    if (corDoNavegador) { corDoNavegador.content = escuro ? "#0a0f1d" : "#16233f"; }
  }

  aplicarTema(raiz.getAttribute("data-tema"));

  if (temaBotao) {
    temaBotao.addEventListener("click", function () {
      var novo = raiz.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
      aplicarTema(novo);
      try { localStorage.setItem("tema", novo); } catch (erro) { /* vale só nesta visita */ }
    });
  }

})();
