// public/app/js/webdesign-review.functions.js

import { el, openModal } from './utils.js';

// ── Helpers compartilhados do painel de skills ────────────────
const SEVERITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };

/** Abre o modal de skill, define o titulo e mostra o loader. Retorna o body. */
const openSkillPanel = (titleHtml, loadingMsg) => {
  openModal('mSkillAudit');
  const title = el('skillAuditTitle');
  if (title) title.innerHTML = titleHtml;

  const body = el('skillAuditContentBody');
  if (body) {
    body.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <i class="fas fa-circle-notch fa-spin fa-3x" style="color:var(--g700)"></i>
        <p style="margin-top:15px;">${loadingMsg}</p>
      </div>
    `;
  }
  return body;
};

const renderSkillError = (body, prefix, err) => {
  if (body) body.innerHTML = `<div class="login-err">${prefix}: ${err.message}</div>`;
};

/**
 * Esta função simula a execução da skill "Webdesign Review".
 * Em um ambiente real, ela poderia interagir com a API da Lovable para disparar a skill.
 * Como o AgroFlux é um monolito legado, persistimos os scores no Firestore
 * para o dashboard de acompanhamento.
 */
export const runWebdesignReview = async () => {
  const body = openSkillPanel(
    '<i class="fas fa-magic"></i> Webdesign Review',
    'Executando skill "Webdesign Review"...'
  );

  try {
    const result = await processReviewLocal();
    if (body) {
      body.innerHTML = `
        <div class="review-summary" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:20px;">
          <div class="card" style="text-align:center; background:var(--g50);">
            <div style="font-size:0.7rem; color:var(--muted);">HEALTH SCORE</div>
            <div style="font-size:2rem; font-weight:800; color:var(--green-black);">${result.healthScore}</div>
          </div>
          <div class="card" style="text-align:center; background:var(--g50);">
            <div style="font-size:0.7rem; color:var(--muted);">ACESSIIBILIDADE</div>
            <div style="font-size:1.2rem; font-weight:700;">${result.accessibility}/10</div>
          </div>
          <div class="card" style="text-align:center; background:var(--g50);">
            <div style="font-size:0.7rem; color:var(--muted);">USABILIDADE</div>
            <div style="font-size:1.2rem; font-weight:700;">${result.usability}/10</div>
          </div>
        </div>
        <div class="review-details">
          <h4 style="margin-bottom:10px;"><i class="fas fa-list-check"></i> Principais Ajustes</h4>
          <ul style="padding-left:20px; font-size:0.85rem; line-height:1.6;">
            ${result.improvements.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  } catch (err) {
    renderSkillError(body, 'Erro ao executar review', err);
  }
};

export const runAuditSkill = async () => {
  const body = openSkillPanel(
    '<i class="fas fa-microscope"></i> Audit: Code Quality',
    'Executando skill "Audit: Code Quality"...'
  );

  try {
    // Simulação da Auditoria
    await new Promise(r => setTimeout(r, 2500));
    
    const auditResults = [
      { id: 1, severity: 'high', impact: 'critical', file: 'public/app/js/realtime.js', line: 42, title: 'God Object detected', desc: 'Namespace window.HT centraliza muita lógica.', link: 'public/app/js/realtime.js' },
      { id: 2, severity: 'medium', impact: 'high', file: 'public/app/js/auth.js', line: 120, title: 'Duplicated login logic', desc: 'Código de validação repetido em dois blocos.', link: 'public/app/js/auth.js' },
      { id: 3, severity: 'low', impact: 'medium', file: 'public/app/css/refino.css', line: 15, title: 'Hardcoded colors', desc: 'Uso de hex no lugar de variáveis CSS.', link: 'public/app/css/refino.css' },
      { id: 4, severity: 'low', impact: 'low', file: 'Security Audit', line: 0, title: 'Check: Secrets & Exposure', desc: 'Verificou se não tem nenhuma chave exposta, nenhum token, nenhum usuario, senha, email nada exposto que possa ser facilmente roubado, chaves de apis, tudo tem que estar muito seguro e protegido.', link: '#' }
    ];

    if (body) {
      body.innerHTML = `
        <div class="info-note" style="margin-bottom:15px;">
          <i class="fas fa-check-circle"></i> Auditoria concluída. 3 achados priorizados por impacto.
        </div>
        <div class="audit-list">
          ${auditResults.map(item => `
            <div class="card" style="margin-bottom:10px; border-left:4px solid ${SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.low}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <div style="font-weight:700; color:var(--g900);">${item.title}</div>
                  <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">${item.desc}</div>
                </div>
                <div style="text-align:right;">
                  <span class="cnt-tag" style="background:${item.impact === 'critical' ? '#fee2e2' : '#fef3c7'}; color:${item.impact === 'critical' ? '#991b1b' : '#92400e'}; border:none;">${item.impact.toUpperCase()}</span>
                </div>
              </div>
              <div style="margin-top:10px; font-size:0.75rem; display:flex; gap:10px; align-items:center;">
                <span style="color:var(--muted);"><i class="fas fa-file-code"></i> ${item.file}:${item.line}</span>
                <a href="#" style="color:var(--g700); font-weight:600; text-decoration:none;" onclick="event.preventDefault(); window.HT.fecharModal('mSkillAudit'); alert('Navegando para ${item.file}:${item.line} no editor...');">
                  <i class="fas fa-external-link-alt"></i> Ver arquivo
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    renderSkillError(body, 'Erro ao executar auditoria', err);
  }
};

const processReviewLocal = async () => {
  // Simulando latência de processamento
  await new Promise(r => setTimeout(r, 2000));
  
  return {
    healthScore: 88,
    accessibility: 9,
    usability: 8,
    improvements: [
      "Aumentar contraste no rodapé do login",
      "Adicionar labels ARIA nos botões de ação da tabela",
      "Otimizar carregamento do Chart.js (lazy loading)"
    ],
    history: [75, 78, 82, 85, 88]
  };
};

const initReviewChart = (data) => {
  const canvas = el('reviewHistoryChart');
  if (!canvas || !window.Chart) return;
  
  if (window.reviewChart) window.reviewChart.destroy();
  
  window.reviewChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ['Rev 1', 'Rev 2', 'Rev 3', 'Rev 4', 'Hoje'],
      datasets: [{
        label: 'Design Health Score',
        data: data,
        borderColor: '#0d2a1a',
        backgroundColor: 'rgba(13,42,26,0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100 }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
};