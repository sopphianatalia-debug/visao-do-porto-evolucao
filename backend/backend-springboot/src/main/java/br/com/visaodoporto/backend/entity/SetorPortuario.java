package br.com.visaodoporto.backend.entity;

import java.util.Arrays;
import java.util.Optional;

/**
 * Setores operacionais do porto. Os códigos são os mesmos usados pelo EPI Vision
 * (epi_tracker/app/domain/sectors.py), para que Spring, Tracker e front falem a mesma língua.
 */
public enum SetorPortuario {
    GRANEIS_SOLIDOS,
    GRANEIS_LIQUIDOS,
    CARGA_GERAL_CELULOSE,
    PIER_BORDO,
    MANUTENCAO_ENGENHARIA,
    GUARDA_PORTUARIA;

    public static Optional<SetorPortuario> deCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return Optional.empty();
        }
        String c = codigo.strip().toUpperCase();
        return Arrays.stream(values()).filter(s -> s.name().equals(c)).findFirst();
    }
}
