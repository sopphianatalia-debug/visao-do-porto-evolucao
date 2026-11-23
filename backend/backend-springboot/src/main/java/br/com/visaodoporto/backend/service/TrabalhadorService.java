package br.com.visaodoporto.backend.service;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import br.com.visaodoporto.backend.entity.SetorPortuario;
import br.com.visaodoporto.backend.entity.Trabalhador;
import br.com.visaodoporto.backend.repository.TrabalhadorRepository;

@Service
@Transactional(readOnly = true)
public class TrabalhadorService {
    private final TrabalhadorRepository repository;

    public TrabalhadorService(TrabalhadorRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Trabalhador cadastrar(String nome, String matricula, String empresa) {
        return cadastrar(nome, matricula, empresa, null, null);
    }

    @Transactional
    public Trabalhador cadastrar(String nome, String matricula, String empresa,
                                 String setor, String cargo) {
        if (nome == null || nome.isBlank() || matricula == null || matricula.isBlank()
                || empresa == null || empresa.isBlank()) {
            throw new IllegalArgumentException("Nome, matrícula e empresa são obrigatórios.");
        }
        String codigo = matricula.strip();
        if (repository.existsByMatricula(codigo)) {
            throw new IllegalArgumentException("Matrícula já cadastrada.");
        }
        Trabalhador t = new Trabalhador(nome.strip(), codigo, empresa.strip());
        t.definirLotacao(parseSetor(setor), limpar(cargo));
        return repository.save(t);
    }

    @Transactional
    public Trabalhador atualizar(UUID id, String nome, String empresa, String setor, String cargo) {
        if (nome == null || nome.isBlank() || empresa == null || empresa.isBlank()) {
            throw new IllegalArgumentException("Nome e empresa são obrigatórios.");
        }
        Trabalhador t = buscarPorId(id);
        t.atualizar(nome.strip(), empresa.strip(), parseSetor(setor), limpar(cargo));
        return repository.save(t);
    }

    /** Ativa/desativa. Trabalhador inativo não recebe novas capacitações (regra já existente). */
    @Transactional
    public Trabalhador alterarAtivo(UUID id, boolean ativo) {
        Trabalhador t = buscarPorId(id);
        t.definirAtivo(ativo);
        return repository.save(t);
    }

    public List<Trabalhador> listar() { return repository.findAll(); }

    public Trabalhador buscarPorId(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Trabalhador não encontrado."));
    }

    private static SetorPortuario parseSetor(String setor) {
        if (setor == null || setor.isBlank()) {
            return null;
        }
        return SetorPortuario.deCodigo(setor).orElseThrow(() ->
                new IllegalArgumentException("Setor desconhecido: " + setor.strip()));
    }

    private static String limpar(String s) {
        return (s == null || s.isBlank()) ? null : s.strip();
    }
}
