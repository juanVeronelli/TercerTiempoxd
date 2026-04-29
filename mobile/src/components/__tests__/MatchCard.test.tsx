/**
 * Tests para la tarjeta de partido (NextMatchCard).
 * Verifica renderizado, texto "Fecha 5" y resultado, onPress y snapshot del diseño.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { NextMatchCard } from "../NextMatchCard";

const mockMatch = {
  id: "match-1",
  date_time: "2030-03-05T18:00:00.000Z",
  location_name: "Cancha Fecha 5",
  price_per_player: 1500,
  status: "OPEN",
  has_confirmed: false,
  user_status: "PENDING",
};

describe("MatchCard (NextMatchCard)", () => {
  const defaultProps = {
    match: mockMatch,
    isAdmin: false,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza la tarjeta con props de prueba (partido ficticio)", () => {
    const { getByText } = render(<NextMatchCard {...defaultProps} />);

    expect(getByText("Cancha Fecha 5")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByText("ABIERTO")).toBeTruthy();
    expect(getByText(/1500/)).toBeTruthy();
  });

  it("muestra correctamente el texto 'Fecha 5' (ubicación) y el resultado (estado ABIERTO)", () => {
    const { getByText } = render(<NextMatchCard {...defaultProps} />);

    const fecha5 = getByText("Cancha Fecha 5");
    expect(fecha5).toBeTruthy();
    expect(fecha5.props.children).toContain("Fecha 5");

    const resultado = getByText("ABIERTO");
    expect(resultado).toBeTruthy();
  });

  it("al presionar el botón CONFIRMAR ASISTENCIA se llama onConfirm", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <NextMatchCard {...defaultProps} onConfirm={onConfirm} />
    );

    const confirmButton = getByText("CONFIRMAR ASISTENCIA");
    fireEvent.press(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("no muestra confirmar si el usuario no está convocado (NOT_CONVOKED)", () => {
    const { getByText, queryByText } = render(
      <NextMatchCard
        {...defaultProps}
        match={{
          ...mockMatch,
          user_status: "NOT_CONVOKED",
        }}
      />
    );

    expect(
      getByText("No estás en la convocatoria de este partido"),
    ).toBeTruthy();
    expect(queryByText("CONFIRMAR ASISTENCIA")).toBeNull();
  });

  it("no muestra confirmar si ya pasó el horario del partido (convocado)", () => {
    const { getByText, queryByText } = render(
      <NextMatchCard
        {...defaultProps}
        match={{
          ...mockMatch,
          date_time: "2020-01-01T18:00:00.000Z",
          user_status: "PENDING",
        }}
      />
    );

    expect(
      getByText(/Ya pasó el horario del partido/i),
    ).toBeTruthy();
    expect(queryByText("CONFIRMAR ASISTENCIA")).toBeNull();
  });

  it("coincide con el snapshot del diseño (evita regresiones visuales)", () => {
    const { toJSON } = render(<NextMatchCard {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
