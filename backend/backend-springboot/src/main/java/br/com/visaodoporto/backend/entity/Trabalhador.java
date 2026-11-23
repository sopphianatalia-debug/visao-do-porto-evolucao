
package br.com.visaodoporto.backend.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "trabalhadores")
public class Trabalhador {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String matricula;

    @Column(nullable = false)
    private String empresa;

    @Column(nullable = false)
    private boolean ativo = true;

    @Enumerated(EnumType.STRING)
    private SetorPortuario setor;

    private String cargo;

    protected Trabalhador() {
    }

    public Trabalhador(
            String nome,
            String matricula,
            String empresa) {

        this.nome = nome;
        this.matricula = matricula;
        this.empresa = empresa;
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getMatricula() {
        return matricula;
    }

    public String getEmpresa() {
        return empresa;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public SetorPortuario getSetor() {
        return setor;
    }

    public String getCargo() {
        return cargo;
    }

    public void atualizar(String nome, String empresa, SetorPortuario setor, String cargo) {
        this.nome = nome;
        this.empresa = empresa;
        this.setor = setor;
        this.cargo = cargo;
    }

    public void definirLotacao(SetorPortuario setor, String cargo) {
        this.setor = setor;
        this.cargo = cargo;
    }

    public void definirAtivo(boolean ativo) {
        this.ativo = ativo;
    }
}
