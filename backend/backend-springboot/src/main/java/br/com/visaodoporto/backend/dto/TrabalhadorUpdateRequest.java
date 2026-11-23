package br.com.visaodoporto.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Edição de trabalhador. A matrícula não muda (é a chave de negócio). */
public record TrabalhadorUpdateRequest(
    @NotBlank @Size(max = 255) String nome,
    @NotBlank @Size(max = 255) String empresa,
    @Size(max = 64) String setor,
    @Size(max = 255) String cargo
) {}
