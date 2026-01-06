document.addEventListener('DOMContentLoaded', () => {
    const tabela = document.getElementById('tabela-marcas');
    const modal = document.getElementById('modal-marca');
    const inputId = document.getElementById('input-id-marca');
    const inputNome = document.getElementById('input-nome-marca');
    
    carregarMarcas();

    async function carregarMarcas() {
        tabela.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
        try {
            const res = await fetch('/api/marcas');
            const marcas = await res.json();
            tabela.innerHTML = '';
            
            marcas.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${m.id}</td>
                    <td>${m.nome}</td>
                    <td>
                        <button class="btn-acao" onclick="editarMarca(${m.id}, '${m.nome}')">✏️</button>
                        <button class="btn-navegacao" style="background-color: #ef4444; color: white;" onclick="excluirMarca(${m.id})">🗑️</button>
                    </td>
                `;
                tabela.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }

    document.getElementById('btn-nova-marca').onclick = () => {
        inputId.value = '';
        inputNome.value = '';
        document.getElementById('titulo-modal').textContent = 'Nova Marca';
        modal.style.display = 'block';
        inputNome.focus();
    };

    window.editarMarca = (id, nome) => {
        inputId.value = id;
        inputNome.value = nome;
        document.getElementById('titulo-modal').textContent = 'Editar Marca';
        modal.style.display = 'block';
    };

    window.excluirMarca = async (id) => {
        if(!confirm('Tem certeza? Isso pode afetar avarias existentes.')) return;
        try {
            const res = await fetch(`/api/marcas/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if(res.ok) { carregarMarcas(); } 
            else { alert('Erro: ' + json.error); }
        } catch(e) { alert(e.message); }
    };

    document.getElementById('btn-salvar-marca').onclick = async () => {
        const id = inputId.value;
        const nome = inputNome.value;
        if(!nome) return alert('Nome obrigatório');

        const url = id ? `/api/marcas/${id}` : '/api/marcas';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nome: nome })
            });
            const json = await res.json();
            if(res.ok) {
                modal.style.display = 'none';
                carregarMarcas();
            } else {
                alert('Erro: ' + json.error);
            }
        } catch(e) { alert(e.message); }
    };

    document.getElementById('fechar-modal-marca').onclick = () => modal.style.display = 'none';
});