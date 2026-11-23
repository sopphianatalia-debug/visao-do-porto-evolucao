package br.com.visaodoporto.backend.dto;

import java.util.UUID;

import br.com.visaodoporto.backend.entity.Trabalhador;

/** Saída pública: a entidade JPA não é mais exposta diretamente pela API. */
public record TrabalhadorResponse(
    UUID id,
    String nome,
    String matricula,
    String empresa,
    String setor,
    String cargo,
    boolean ativo
) {
    public static TrabalhadorResponse de(Trabalhador t) {
        return new TrabalhadorResponse(
            t.getId(), t.getNome(), t.getMatricula(), t.getEmpresa(),
            t.getSetor() == null ? null : t.getSetor().name(),
            t.getCargo(), t.isAtivo());
    }
}
